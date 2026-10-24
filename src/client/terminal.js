/**
 * The terminal page: what the model is doing on the remote hosts right now.
 *
 * The page reads the Host's activity stream and presents it like a terminal
 * session: a prompt line per command, the output underneath, and a dim exit
 * line when the command ends. On top of that it adds the controls a watcher
 * wants - a live indicator, a host filter, a search box, and the ability to
 * copy or clear the view.
 */

/** How many lines the view keeps. */
const MAX_ROWS = 800

/**
 * Turn one activity event into terminal lines.
 * @returns a list of row descriptors, each `{ time, host, text, kind, ok }`.
 */
export function rowsOf(event) {
  // A 24-hour clock without the AM/PM marker: it fits the gutter and needs no
  // locale, so the column stays the same width everywhere.
  const date = new Date(event.at)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
  const host = String(event.host ?? 'remote')
  if (event.kind === 'start') {
    const tool = String(event.tool ?? '')
    const verb = tool === 'ssh_upload' ? 'scp ▸ ' : tool === 'ssh_download' ? 'scp ◂ ' : ''
    return [{ time, host, text: `$ ${verb}${String(event.detail ?? '')}`, kind: 'cmd' }]
  }
  if (event.kind === 'end') {
    const ok = event.failed !== true && event.exitCode === 0
    const status = event.failed === true
      ? 'failed'
      : `exit ${event.exitCode}${event.timedOut === true ? ' (timeout)' : ''}`
    const rows = [
      { time, host, text: `↳ ${status} · ${event.durationMs}ms`, kind: 'exit', ok },
    ]
    if (typeof event.text === 'string' && event.text !== '') {
      for (const line of event.text.split('\n').slice(0, 20)) {
        rows.push({ time: '', host: '', text: line, kind: 'err' })
      }
    }
    return rows
  }
  const text = String(event.text ?? '')
  if (text === '') return []
  const clean = text.endsWith('\n') ? text.slice(0, -1) : text
  const kind = event.stream === 'stderr' ? 'err' : 'out'
  return clean.split('\n').map((line) => ({ time: '', host: '', text: line, kind }))
}

/**
 * Give every output line the gutter of the command it belongs to, so the
 * columns stay aligned when stderr follows stdout.
 */
export function alignRows(rows) {
  let time = ''
  let host = ''
  return rows.map((row) => {
    if (row.time !== '') time = row.time
    if (row.host !== '') host = row.host
    return { ...row, gutterTime: time, gutterHost: host }
  })
}

/**
 * The terminal page component.
 * @param jsx - the JSX factory.
 * @param jsxs - the JSX factory for multiple children.
 * @param react - the React runtime.
 */
export function createTerminalPage(jsx, jsxs, react) {
  return function SshTerminal(props) {
    const [rows, setRows] = react.useState(
      props.events === undefined ? [] : props.events.flatMap(rowsOf),
    )
    const [state, setState] = react.useState(props.events === undefined ? 'connecting' : 'live')
    const [filter, setFilter] = react.useState('')
    const [query, setQuery] = react.useState('')
    const [follow, setFollow] = react.useState(true)
    const [cleared, setCleared] = react.useState(0)
    const bodyRef = react.useRef(null)

    react.useEffect(() => {
      if (typeof EventSource === 'undefined') {
        setState('unsupported')
        return undefined
      }
      const source = new EventSource('/plugins/dsh-ssh/live')
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
        setRows((previous) => {
          const next = previous.concat(fresh)
          return next.length > MAX_ROWS ? next.slice(next.length - MAX_ROWS) : next
        })
      }
      return () => source.close()
    }, [])

    react.useEffect(() => {
      const body = bodyRef.current
      if (body !== null && follow) body.scrollTop = body.scrollHeight
    }, [rows, follow])

    const hosts = Array.from(new Set(rows.map((row) => row.host).filter(Boolean))).sort()
    const visible = alignRows(
      rows.filter((row) => {
        if (filter !== '' && row.host !== '' && row.host !== filter) return false
        if (query !== '' && !row.text.toLowerCase().includes(query.toLowerCase())) return false
        return true
      }),
    )
    const errors = rows.filter((row) => row.kind === 'err' && row.ok !== true).length

    const copyAll = () => {
      const text = visible.map((row) => row.text).join('\n')
      void navigator.clipboard?.writeText(text)
    }

    return jsxs('section', {
      className: 'dssTerm',
      children: [
        jsxs('header', {
          className: 'dssTermBar',
          children: [
            jsx('span', { className: 'dssDot', 'data-state': state }),
            jsx('span', {
              className: 'dssTermCount',
              children:
                state === 'live' ? '实时' : state === 'closed' ? '已断开，重试中' : state === 'unsupported' ? '此浏览器不支持实时流' : '连接中…',
            }),
            jsx('span', { className: 'dssTermCount', children: `· ${visible.length} 行` }),
            errors > 0 ? jsx('span', { className: 'dssTermCount', children: `· ${errors} 条错误` }) : null,
            jsxs('div', {
              className: 'dssTermBar',
              style: { marginLeft: 'auto', gap: '6px' },
              children: [
                hosts.length > 0
                  ? jsx('select', {
                      className: 'dssInput',
                      style: { width: 'auto', colorScheme: 'dark' },
                      value: filter,
                      onChange: (event) => setFilter(event.target.value),
                      children: [
                        jsx('option', { value: '', children: '全部主机' }),
                        ...hosts.map((host) => jsx('option', { value: host, children: host }, host)),
                      ],
                    })
                  : null,
                jsx('input', {
                  className: 'dssInput',
                  style: { width: '140px' },
                  type: 'search',
                  value: query,
                  placeholder: '搜索输出',
                  onChange: (event) => setQuery(event.target.value),
                }),
                jsx('button', {
                  type: 'button',
                  className: 'dssBtn',
                  'aria-pressed': follow ? 'true' : 'false',
                  onClick: () => setFollow((previous) => !previous),
                  children: follow ? '跟随最新' : '已暂停跟随',
                }),
                jsx('button', {
                  type: 'button',
                  className: 'dssBtn',
                  onClick: copyAll,
                  children: '复制',
                }),
                jsx('button', {
                  type: 'button',
                  className: 'dssBtn',
                  onClick: () => {
                    setRows([])
                    setCleared((count) => count + 1)
                  },
                  children: '清空',
                }),
              ],
            }),
          ],
        }),
        jsx('div', {
          className: 'dssTermBody',
          ref: bodyRef,
          children:
            visible.length === 0
              ? jsx('p', {
                  className: 'dssTermEmpty',
                  children:
                    rows.length === 0
                      ? '等待 SSH 活动…\n模型调用 ssh_exec / ssh_upload / ssh_download 时，这里会像真实终端一样逐行显示命令与输出。'
                      : '没有符合当前筛选条件的行。',
                })
              : visible.map((row, index) =>
                  jsx(
                    'p',
                    {
                      className: 'dssLine',
                      children: [
                        jsx('span', { className: 'dssTime', children: row.gutterTime ?? row.time }),
                        jsx('span', { className: 'dssTermHost', children: row.gutterHost ?? row.host }),
                        jsx('span', {
                          className:
                            row.kind === 'cmd'
                              ? 'dssCmd'
                              : row.kind === 'err'
                                ? 'dssErr'
                                : row.kind === 'exit'
                                  ? 'dssExit'
                                  : 'dssOut',
                          'data-ok': row.kind === 'exit' ? String(row.ok !== false) : undefined,
                          children: row.text,
                        }),
                      ],
                    },
                    index,
                  )
                ),        }),
      ],
    })
  }
}
