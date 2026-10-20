/**
 * Client half of dsh-ssh: an SSH terminal page in the right sidebar.
 *
 * It registers a sidebar-right tab kind (`ssh-live`) so the sidebar's add/guide
 * UI can open it, then renders the Host's live activity stream the way a real SSH
 * session looks: a prompt line per command, streamed stdout/stderr underneath, and
 * a dim exit line when the command finishes.
 *
 * Client modules run inside the page and must stay self-contained: `react` comes
 * from the loader, data comes from the Host's same-origin SSE route, and every
 * colour is a `--dsw-alias-*` theme token so the page follows the active theme.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ssh',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const react = require('react')
    const { jsx, jsxs } = require('react/jsx-runtime')

    /** Tab kind; the pane body and title slots are keyed by it. */
    const KIND = 'ssh-live'
    /** Same-origin stream served by the Host plugin. */
    const LIVE_URL = '/plugins/dsh-ssh/live'
    /** Lines kept in the viewer. */
    const MAX_ROWS = 600

    const css = `
.dssTerm{display:flex;flex-direction:column;min-height:0;height:100%;background:var(--dsw-alias-bg-base,transparent)}
.dssTermBar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:.5px solid var(--dsw-alias-border-l2);font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);flex:none}
.dssTermDot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary);flex:none}
.dssTermDot[data-state=live]{background:var(--dsw-alias-state-business-primary)}
.dssTermBody{min-height:0;flex:1;overflow:auto;padding:8px 10px 16px;font-family:ui-monospace,SFMono-Regular,"JetBrainsMono Nerd Font",Menlo,Consolas,monospace;font-size:12px;line-height:18px;white-space:pre-wrap;word-break:break-all;color:var(--dsw-alias-label-primary)}
.dssRow{margin:0}
.dssPrompt{color:var(--dsw-alias-state-business-primary);font-weight:600}
.dssCmd{color:var(--dsw-alias-label-primary);font-weight:600}
.dssOut{color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary))}
.dssErr{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.dssExit{color:var(--dsw-alias-label-tertiary)}
.dssExit[data-ok=false]{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary))}
.dssHint{color:var(--dsw-alias-label-tertiary);margin:0}
`

    const tagId = 'dsh-ssh/terminal.css'
    if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-ssh'
      tag.dataset.pluginCss = tagId
      tag.textContent = css
      document.head.appendChild(tag)
    }

    /** The prompt an SSH user would see before typing on that host. */
    function promptOf(event) {
      const tool = String(event.tool ?? '')
      const verb = tool === 'ssh_upload' ? 'scp ▸ ' : tool === 'ssh_download' ? 'scp ◂ ' : ''
      return { verb, host: String(event.host ?? 'remote') }
    }

    /** Turn one activity event into terminal rows: `[text, className]`. */
    function rowsOf(event) {
      const time = new Date(event.at).toLocaleTimeString()
      if (event.kind === 'start') {
        const { verb, host } = promptOf(event)
        return [['line', [`${host}`, 'dssPrompt'], [` $ ${verb}${String(event.detail ?? '')}`, 'dssCmd']]]
      }
      if (event.kind === 'end') {
        const ok = event.failed !== true && event.exitCode === 0
        const status = event.failed === true
          ? 'failed'
          : `exit ${event.exitCode}${event.timedOut === true ? ' (timeout)' : ''}`
        const rows = [['line', [`  ↳ ${status} · ${event.durationMs}ms · ${time}`, 'dssExit', ok]]]
        if (typeof event.text === 'string' && event.text !== '') {
          for (const line of event.text.split('\n').slice(0, 20)) rows.push(['line', [`  ${line}`, 'dssErr']])
        }
        return rows
      }
      const text = String(event.text ?? '')
      if (text === '') return []
      const clean = text.endsWith('\n') ? text.slice(0, -1) : text
      const cls = event.stream === 'stderr' ? 'dssErr' : 'dssOut'
      return clean.split('\n').map((line) => ['line', [line, cls]])
    }

    /** Terminal-style live view of the model's SSH activity. */
    function SshTerminal() {
      const [rows, setRows] = react.useState([])
      const [state, setState] = react.useState('connecting')
      const [count, setCount] = react.useState(0)
      const bodyRef = react.useRef(null)

      react.useEffect(() => {
        if (typeof EventSource === 'undefined') {
          setState('unsupported')
          return undefined
        }
        const source = new EventSource(LIVE_URL)
        source.onopen = () => setState('live')
        source.onerror = () => setState('closed')
        source.onmessage = (message) => {
          let event
          try {
            event = JSON.parse(message.data)
          } catch {
            return
          }
          const fresh = rowsOf(event)
          if (fresh.length === 0) return
          setCount((n) => n + 1)
          setRows((previous) => {
            const next = previous.concat(fresh)
            return next.length > MAX_ROWS ? next.slice(next.length - MAX_ROWS) : next
          })
        }
        return () => source.close()
      }, [])

      react.useEffect(() => {
        const body = bodyRef.current
        if (body !== null) body.scrollTop = body.scrollHeight
      }, [rows])

      return jsxs('section', {
        className: 'dssTerm',
        children: [
          jsxs('header', {
            className: 'dssTermBar',
            children: [
              jsx('span', { className: 'dssTermDot', 'data-state': state }),
              jsx('span', {
                children: state === 'live' ? '实时' : state === 'closed' ? '已断开，重试中' : '连接中…'
              }),
              jsx('span', { children: `· ${count} 次调用` }),
              jsx('span', { style: { marginLeft: 'auto' }, children: 'SSH 终端' })
            ]
          }),
          jsx('div', {
            className: 'dssTermBody',
            ref: bodyRef,
            children: rows.length === 0
              ? jsx('p', {
                  className: 'dssHint',
                  children:
                    '等待 SSH 活动…\n模型调用 ssh_exec / ssh_upload / ssh_download 时，这里会像真实终端一样逐行显示命令与输出。'
                })
              : rows.map(([kind, parts], index) =>
                  jsx(
                    'p',
                    {
                      className: 'dssRow',
                      'data-kind': kind,
                      children: parts.map(([text, cls], partIndex) =>
                        jsx('span', { className: cls, children: text }, partIndex)
                      )
                    },
                    index
                  )
                )
          })
        ]
      })
    }

    /** Tab title seat. */
    function SshTerminalTitle() {
      return jsx('span', { children: 'SSH 终端' })
    }

    /** Small guide icon: a terminal prompt. */
    function GuideIcon() {
      return jsx('svg', {
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
        children: [
          jsx('rect', { x: 1.2, y: 2.2, width: 13.6, height: 11.6, rx: 3, stroke: 'currentColor', 'stroke-width': 1.2 }),
          jsx('path', { d: 'M4.6 6.2 6.6 8l-2 1.8', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
          jsx('path', { d: 'M8.4 10h3', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-linecap': 'round' })
        ]
      })
    }

    /** Register the tab kind, its pane body and its title. */
    function apply(ctx) {
      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: 'dsh-ssh',
            kind: KIND,
            multiple: false,
            title: () => 'SSH 终端',
            guide: [
              {
                id: 'ssh-live',
                order: 30,
                title: () => 'SSH 终端',
                description: () => '实时查看模型在远程主机上执行的命令与输出',
                icon: GuideIcon
              }
            ]
          }),
        'dsh-ssh.tab-kind'
      )
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab', key: KIND }, SshTerminal)
          ),
        'dsh-ssh.tab-body'
      )
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab.title', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: KIND }, SshTerminalTitle)
          ),
        'dsh-ssh.tab-title'
      )
    }

    exports.apply = apply
    exports.inject = ['slots', 'sidebarRight', 'sidebarRightTabs']
    return module.exports
  }
})
