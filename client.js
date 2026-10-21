/**
 * Client half of dsh-ssh: a settings page and a live terminal page in the web UI.
 *
 * - Settings page (`settings.section`): edits the plugin's own `hosts` list through
 *   the Host `settings` service, so the panel and the profile YAML stay one config.
 * - Sidebar-right tab (`sidebarRightTabs` + `sidebar.right.pane.tab`): streams the
 *   Host's same-origin SSE activity log and renders it like a real SSH session.
 *
 * Client modules run inside the page: `react` comes from the loader, no Harness
 * primitives are imported, and every colour is a `--dsw-alias-*` theme token so the
 * pages follow the active theme.
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
    /** Rows kept in the terminal view. */
    const MAX_ROWS = 600
    const AUTH_KINDS = ['agent', 'key', 'password']

    const css = `
.dssTerm{display:flex;flex-direction:column;min-height:0;height:100%}
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
.dssHint{color:var(--dsw-alias-label-tertiary);margin:0;white-space:pre-wrap}
.dssSet{display:flex;flex-direction:column;gap:14px;max-width:760px;color:var(--dsw-alias-label-primary)}
.dssSetTitle{margin:0;font-size:18px;font-weight:600}
.dssSetIntro{margin:0;font-size:13px;color:var(--dsw-alias-label-tertiary);line-height:20px}
.dssSetList{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
.dssSetCard{border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.dssSetGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.dssSetField{display:flex;flex-direction:column;gap:3px;min-width:0}
.dssSetLabel{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dssSetInput,.dssSetSelect{font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:transparent;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 8px;min-width:0}
.dssSetInput:focus-visible,.dssSetSelect:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dssSetRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dssSetBtn{font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:transparent;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 10px;cursor:pointer}
.dssSetBtn:hover{background:var(--dsw-alias-bg-l2,transparent)}
.dssSetNote{font-size:12px;color:var(--dsw-alias-label-tertiary);margin:0}
.dssSetErr{font-size:12px;color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary));margin:0}
`

    const tagId = 'dsh-ssh/ui.css'
    if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-ssh'
      tag.dataset.pluginCss = tagId
      tag.textContent = css
      document.head.appendChild(tag)
    }

    /** Human-readable message from an unknown thrown value. */
    function messageOf(error) {
      return error instanceof Error ? error.message : String(error)
    }

    /* ------------------------------------------------------------------ */
    /* settings page                                                       */
    /* ------------------------------------------------------------------ */

    const EMPTY_HOST = {
      name: '',
      host: '',
      port: 22,
      username: '',
      password: '',
      auth: 'agent',
      identityFile: '',
      passwordEnv: '',
      passwordFile: '',
    }

    const HOST_FIELDS = Object.keys(EMPTY_HOST)

    /** Normalize one stored host row for the form. */
    function hostRow(host) {
      const row = { ...EMPTY_HOST }
      for (const field of HOST_FIELDS) {
        if (host[field] !== undefined && host[field] !== null) row[field] = host[field]
      }
      return row
    }

    /** One labeled input inside the settings page. */
    function Field(props) {
      return jsxs('label', {
        className: 'dssSetField',
        children: [
          jsx('span', { className: 'dssSetLabel', children: props.label }),
          jsx('input', {
            className: 'dssSetInput',
            type: props.type ?? 'text',
            value: props.value ?? '',
            placeholder: props.placeholder ?? '',
            onChange: (event) => props.onChange(event.target.value),
          }),
        ],
      })
    }

    /** The plugin's settings page: edit the allow-listed SSH hosts. */
    function SshHostsSettings(props) {
      const [status, setStatus] = react.useState('loading')
      const [hosts, setHosts] = react.useState([])
      const [revision, setRevision] = react.useState(undefined)
      const [note, setNote] = react.useState('')
      const [error, setError] = react.useState('')

      const reload = react.useCallback(async () => {
        setError('')
        try {
          const loaded = await props.load()
          setHosts(loaded.hosts.map(hostRow))
          setRevision(loaded.revision)
          setStatus('ready')
        } catch (loadError) {
          setStatus('error')
          setError(messageOf(loadError))
        }
      }, [props])

      react.useEffect(() => {
        void reload()
      }, [reload])

      const edit = (index, field, value) =>
        setHosts((previous) =>
          previous.map((row, position) => (position === index ? { ...row, [field]: value } : row))
        )
      const add = () => setHosts((previous) => previous.concat({ ...EMPTY_HOST }))
      const remove = (index) => setHosts((previous) => previous.filter((_, position) => position !== index))

      const save = async () => {
        setNote('保存中…')
        setError('')
        try {
          const rows = hosts.map((row) => {
            const out = {}
            for (const field of HOST_FIELDS) {
              const value = row[field]
              if (value === '' || value === undefined) continue
              out[field] = field === 'port' ? Number(value) : value
            }
            return out
          })
          await props.save(rows, revision)
          setNote('已保存，配置已生效')
          await reload()
        } catch (saveError) {
          setNote('')
          setError(`保存失败：${messageOf(saveError)}`)
        }
      }

      if (status === 'loading') return jsx('p', { className: 'dssHint', children: '读取配置…' })
      if (status === 'error') {
        return jsxs('div', { className: 'dssSet', children: [jsx('p', { className: 'dssSetErr', children: error })] })
      }

      return jsxs('div', {
        className: 'dssSet',
        children: [
          jsx('h2', { className: 'dssSetTitle', children: 'SSH 主机' }),
          jsx('p', {
            className: 'dssSetIntro',
            children:
              '模型只能连接这里列出的主机（按别名调用）。密码可以三种方式给：直接填「密码」（明文存进 profile 的 cordis.patch.yml）、填环境变量名、或填 0600 密码文件路径。',
          }),
          hosts.length === 0
            ? jsx('p', { className: 'dssHint', children: '还没有主机，点下面「添加主机」。' })
            : jsx('ul', {
                className: 'dssSetList',
                children: hosts.map((row, index) =>
                  jsxs(
                    'li',
                    {
                      className: 'dssSetCard',
                      children: [
                        jsxs('div', {
                          className: 'dssSetGrid',
                          children: [
                            jsx(Field, {
                              label: '别名（工具里用）',
                              value: row.name,
                              placeholder: 'prod',
                              onChange: (value) => edit(index, 'name', value),
                            }),
                            jsx(Field, {
                              label: '地址 / IP（留空用别名）',
                              value: row.host,
                              placeholder: 'example.com',
                              onChange: (value) => edit(index, 'host', value),
                            }),
                            jsx(Field, {
                              label: '端口',
                              type: 'number',
                              value: row.port,
                              onChange: (value) => edit(index, 'port', value),
                            }),
                            jsx(Field, {
                              label: '登录用户',
                              value: row.username,
                              placeholder: 'root',
                              onChange: (value) => edit(index, 'username', value),
                            }),
                            jsx(Field, {
                              label: '密码（明文保存）',
                              type: 'password',
                              value: row.password,
                              placeholder: '直接填密码，或用下面的环境变量/文件',
                              onChange: (value) => edit(index, 'password', value),
                            }),
                            jsxs('label', {
                              className: 'dssSetField',
                              children: [
                                jsx('span', { className: 'dssSetLabel', children: '认证方式' }),
                                jsx('select', {
                                  className: 'dssSetSelect',
                                  value: row.auth,
                                  onChange: (event) => edit(index, 'auth', event.target.value),
                                  children: AUTH_KINDS.map((kind) =>
                                    jsx('option', { value: kind, children: kind }, kind)
                                  ),
                                }),
                              ],
                            }),
                            jsx(Field, {
                              label: '私钥路径（auth=key）',
                              value: row.identityFile,
                              placeholder: '~/.ssh/id_ed25519',
                              onChange: (value) => edit(index, 'identityFile', value),
                            }),
                            jsx(Field, {
                              label: '密码所在环境变量名',
                              value: row.passwordEnv,
                              placeholder: 'DSH_SSH_PROD_PASSWORD',
                              onChange: (value) => edit(index, 'passwordEnv', value),
                            }),
                            jsx(Field, {
                              label: '密码文件路径（0600）',
                              value: row.passwordFile,
                              placeholder: '~/.ssh/prod.pass',
                              onChange: (value) => edit(index, 'passwordFile', value),
                            }),
                          ],
                        }),
                        jsx('div', {
                          className: 'dssSetRow',
                          children: jsx('button', {
                            type: 'button',
                            className: 'dssSetBtn',
                            onClick: () => remove(index),
                            children: '删除这台主机',
                          }),
                        }),
                      ],
                    },
                    index
                  )
                ),
              }),
          jsxs('div', {
            className: 'dssSetRow',
            children: [
              jsx('button', { type: 'button', className: 'dssSetBtn', onClick: add, children: '添加主机' }),
              jsx('button', { type: 'button', className: 'dssSetBtn', onClick: () => void save(), children: '保存' }),
              jsx('span', { className: 'dssSetNote', children: note }),
            ],
          }),
          error === '' ? null : jsx('p', { className: 'dssSetErr', children: error }),
          jsx('p', {
            className: 'dssSetNote',
            children:
              '保存后立即生效，无需重启；也可以直接改 profile 的 cordis.patch.yml，两处是同一份配置。直接填的密码是明文保存的，介意就用密码文件或环境变量。',
          }),
        ],
      })
    }

    /* ------------------------------------------------------------------ */
    /* live terminal                                                       */
    /* ------------------------------------------------------------------ */

    /** Turn one activity event into terminal rows of `[[text, className], …]`. */
    function rowsOf(event) {
      const time = new Date(event.at).toLocaleTimeString()
      if (event.kind === 'start') {
        const tool = String(event.tool ?? '')
        const verb = tool === 'ssh_upload' ? 'scp ▸ ' : tool === 'ssh_download' ? 'scp ◂ ' : ''
        return [[[String(event.host ?? 'remote'), 'dssPrompt'], [` $ ${verb}${String(event.detail ?? '')}`, 'dssCmd']]]
      }
      if (event.kind === 'end') {
        const ok = event.failed !== true && event.exitCode === 0
        const status = event.failed === true
          ? 'failed'
          : `exit ${event.exitCode}${event.timedOut === true ? ' (timeout)' : ''}`
        const rows = [[[`  ↳ ${status} · ${event.durationMs}ms · ${time}`, 'dssExit', ok]]]
        if (typeof event.text === 'string' && event.text !== '') {
          for (const line of event.text.split('\n').slice(0, 20)) rows.push([[`  ${line}`, 'dssErr']])
        }
        return rows
      }
      const text = String(event.text ?? '')
      if (text === '') return []
      const clean = text.endsWith('\n') ? text.slice(0, -1) : text
      const cls = event.stream === 'stderr' ? 'dssErr' : 'dssOut'
      return clean.split('\n').map((line) => [[line, cls]])
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
              jsx('span', { children: state === 'live' ? '实时' : state === 'closed' ? '已断开，重试中' : '连接中…' }),
              jsx('span', { children: `· ${count} 次调用` }),
            ],
          }),
          jsx('div', {
            className: 'dssTermBody',
            ref: bodyRef,
            children:
              rows.length === 0
                ? jsx('p', {
                    className: 'dssHint',
                    children:
                      '等待 SSH 活动…\n模型调用 ssh_exec / ssh_upload / ssh_download 时，这里会像真实终端一样逐行显示命令与输出。',
                  })
                : rows.map((parts, index) =>
                    jsx(
                      'p',
                      {
                        className: 'dssRow',
                        children: parts.map(([text, cls], partIndex) =>
                          jsx('span', { className: cls, children: text }, partIndex)
                        ),
                      },
                      index
                    )
                  ),
          }),
        ],
      })
    }

    /** Tab title seat. */
    function SshTerminalTitle() {
      return jsx('span', { children: 'SSH 终端' })
    }

    /** Guide icon: a terminal prompt. */
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
          jsx('path', { d: 'M8.4 10h3', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-linecap': 'round' }),
        ],
      })
    }

    /* ------------------------------------------------------------------ */
    /* registration                                                        */
    /* ------------------------------------------------------------------ */

    /** Find this plugin's own settings namespace among the served descriptors. */
    function pickNamespace(view) {
      const rows = view?.namespaces ?? []
      return (
        rows.find((row) => row.ns === 'dsh-ssh') ??
        rows.find((row) => typeof row.ns === 'string' && row.ns.endsWith('dsh-ssh')) ??
        undefined
      )
    }

    /** Register the settings page, the sidebar tab kind and its pane. */
    function apply(ctx) {
      const describeRow = async () => {
        const response = await ctx.remote.settings.describe()
        if (response?.ok !== true) throw new Error(response?.error?.message ?? '读取设置失败')
        const row = pickNamespace(response.value)
        if (row === undefined) throw new Error('没有找到 dsh-ssh 的配置项（插件可能未生效）')
        return row
      }
      const load = async () => {
        const row = await describeRow()
        return {
          hosts: Array.isArray(row.value?.hosts) ? row.value.hosts : [],
          revision: row.revision,
          writable: row.applies === 'live',
        }
      }
      const save = async (hosts, revision) => {
        const row = await describeRow()
        const written = await ctx.remote.settings.update(row.ns, { hosts }, revision ?? row.revision)
        if (written?.ok !== true) throw new Error(written?.error?.message ?? '保存失败')
      }

      ctx.effect(
        () =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'ssh-hosts',
                order: 30,
                label: () => 'SSH 主机',
                locale: 'settings.ssh-hosts',
                inject: () => ({ load, save }),
              },
              SshHostsSettings
            )
          ),
        'dsh-ssh.settings-page'
      )

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
                icon: GuideIcon,
              },
            ],
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
    exports.inject = ['slots', 'remote', 'remote.settings', 'sidebarRight', 'sidebarRightTabs']
    return module.exports
  }
})
