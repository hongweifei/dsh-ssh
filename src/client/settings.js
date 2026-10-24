/**
 * The settings page: the allow-listed SSH hosts.
 *
 * The page is built around how the page is actually used: a host is one card,
 * its fields are grouped by what they mean, only the fields that matter for the
 * chosen authentication method are shown, and every host keeps its own save
 * state so editing one host never rewrites the others.
 */
import { Button, Caret, Group, Segmented, Tag, TextField } from './shared.js'

/** The authentication methods a host can use. */
const AUTH_OPTIONS = [
  { value: 'agent', label: '自动', title: '交给 OpenSSH：ssh-agent、~/.ssh/config 与默认密钥' },
  { value: 'key', label: '私钥', title: '使用指定的私钥文件' },
  { value: 'password', label: '密码', title: '使用密码或私钥口令' },
]

/** The operating systems a host can run. */
const OS_OPTIONS = [
  { value: 'auto', label: '自动检测', title: '首次连接时探测一次' },
  { value: 'linux', label: 'Linux', title: 'POSIX shell' },
  { value: 'macos', label: 'macOS', title: 'POSIX shell' },
  { value: 'windows', label: 'Windows', title: 'cmd.exe' },
]

/** Where a secret comes from. */
const SECRET_OPTIONS = [
  { value: 'inline', label: '直接填', title: '明文保存在 profile 的 cordis.patch.yml' },
  { value: 'env', label: '环境变量', title: '从环境变量读取口令' },
  { value: 'file', label: '密码文件', title: '从 0600 权限的文件读取口令' },
]

/** A blank host row. */
export function emptyHost() {
  return {
    name: '',
    host: '',
    port: 22,
    username: '',
    auth: 'agent',
    os: 'auto',
    identityFile: '',
    password: '',
    passwordEnv: '',
    passwordFile: '',
  }
}

/** The fields a host row carries. */
export const HOST_FIELDS = Object.keys(emptyHost())

/** Normalize a stored row into the form shape. */
export function hostRow(host) {
  const row = emptyHost()
  for (const field of HOST_FIELDS) {
    if (host[field] !== undefined && host[field] !== null) row[field] = host[field]
  }
  return row
}

/**
 * Validate one host row.
 * @returns a list of human-readable problems; empty means the row is usable.
 */
export function validateHost(row) {
  const problems = []
  if (row.name.trim() === '') problems.push('缺少别名')
  else if (!/^[A-Za-z0-9._-]+$/.test(row.name.trim())) {
    problems.push('别名只能包含字母、数字、点、下划线和连字符')
  }
  const port = Number(row.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push('端口需在 1–65535 之间')
  if (row.auth === 'key' && row.identityFile.trim() === '') problems.push('私钥方式需要填写私钥路径')
  if (row.auth === 'password') {
    const hasInline = row.password !== '' && row.password !== undefined
    const hasEnv = row.passwordEnv.trim() !== ''
    const hasFile = row.passwordFile.trim() !== ''
    if (!hasInline && !hasEnv && !hasFile) problems.push('密码方式需要填写密码、环境变量名或密码文件路径')
  }
  return problems
}

/** Which secret field a row currently uses. */
function secretSource(row) {
  if (row.password !== '' && row.password !== undefined) return 'inline'
  if (row.passwordEnv.trim() !== '') return 'env'
  if (row.passwordFile.trim() !== '') return 'file'
  return 'inline'
}

/** The authentication and address a host row describes, for the summary line. */
function hostSummary(row) {
  const address = row.host.trim() === '' ? row.name.trim() : row.host.trim()
  const user = row.username.trim() === '' ? '' : `${row.username.trim()}@`
  return `${user}${address}:${row.port}`
}

/** The settings page component. */
export function createSettingsPage(jsx, jsxs, react) {
  /** One host card. */
  function HostCard(props) {
    const { row, index, state, actions } = props
    const problems = validateHost(row)
    const open = state.open.includes(index)
    const source = secretSource(row)
    const edit = (field) => (value) => actions.edit(index, field, value)

    const setSecretSource = (next) => {
      if (next === 'inline') actions.edit(index, 'passwordEnv', '')
      if (next === 'env') {
        actions.edit(index, 'password', '')
        actions.edit(index, 'passwordFile', '')
      }
      if (next === 'file') {
        actions.edit(index, 'password', '')
        actions.edit(index, 'passwordEnv', '')
      }
    }

    return jsxs('li', {
      className: 'dssHost',
      'data-invalid': problems.length > 0 ? 'true' : undefined,
      children: [
        jsxs('button', {
          type: 'button',
          className: 'dssHostHead',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => actions.toggle(index),
          children: [
            jsx(Caret, { jsx, open }),
            jsx('span', { className: 'dssHostTitle', children: row.name.trim() === '' ? '未命名主机' : row.name.trim() }),
            jsx('span', { className: 'dssHostMeta', children: hostSummary(row) }),
            jsxs('span', {
              className: 'dssHostTags',
              children: [
                jsx(Tag, { jsx, tone: 'ok', children: row.auth === 'key' ? '私钥' : row.auth === 'password' ? '密码' : '自动' }),
                jsx(Tag, { jsx, tone: row.os === 'auto' ? undefined : 'ok',
                  children: row.os === 'auto' ? '系统自动检测' : row.os === 'windows' ? 'Windows' : row.os === 'macos' ? 'macOS' : 'Linux',
                }),
                problems.length > 0 ? jsx(Tag, { jsx, tone: 'error', children: `${problems.length} 项待补` }) : null,
              ],
            }),
          ],
        }),
        open
          ? jsxs('div', {
              className: 'dssHostBody',
              children: [
                jsx(Group, { jsx, title: '连接',
                  children: [
                    jsx(TextField, { jsx, label: '别名',
                      value: row.name,
                      placeholder: 'prod',
                      hint: '工具调用时用它指定主机，同一配置内唯一',
                      invalid: row.name.trim() === '',
                      onChange: edit('name'),
                    }),
                    jsx(TextField, { jsx, label: '地址',
                      value: row.host,
                      placeholder: 'example.com',
                      hint: '留空则用别名本身',
                      onChange: edit('host'),
                    }),
                    jsx(TextField, { jsx, label: '端口',
                      type: 'number',
                      value: row.port,
                      invalid: !Number.isInteger(Number(row.port)) || Number(row.port) < 1 || Number(row.port) > 65535,
                      onChange: edit('port'),
                    }),
                    jsx(TextField, { jsx, label: '登录用户',
                      value: row.username,
                      placeholder: 'root',
                      onChange: edit('username'),
                    }),
                    jsx('div', {
                      className: 'dssField',
                      children: [
                        jsx('span', { className: 'dssLabel', children: '系统类型' }),
                        jsx(Segmented, { jsx, label: '系统类型',
                          value: row.os,
                          options: OS_OPTIONS,
                          onChange: edit('os'),
                        }),
                      ],
                    }),
                  ],
                }),
                jsx(Group, { jsx, title: '认证',
                  children: [
                    jsx('div', {
                      className: 'dssField',
                      children: [
                        jsx('span', { className: 'dssLabel', children: '方式' }),
                        jsx(Segmented, { jsx, label: '认证方式',
                          value: row.auth,
                          options: AUTH_OPTIONS,
                          onChange: edit('auth'),
                        }),
                      ],
                    }),
                    row.auth === 'key'
                      ? jsx(TextField, { jsx, label: '私钥路径',
                          value: row.identityFile,
                          placeholder: '~/.ssh/id_ed25519',
                          hint: '只对该主机使用这把密钥',
                          onChange: edit('identityFile'),
                        })
                      : null,
                    row.auth === 'password'
                      ? jsxs('div', {
                          className: 'dssField',
                          children: [
                            jsx('span', { className: 'dssLabel', children: '口令来源' }),
                            jsx(Segmented, { jsx, label: '口令来源',
                              value: source,
                              options: SECRET_OPTIONS,
                              onChange: setSecretSource,
                            }),
                            source === 'inline'
                              ? jsx(TextField, { jsx, label: '密码',
                                  type: 'password',
                                  value: row.password,
                                  hint: '明文保存在 cordis.patch.yml',
                                  onChange: edit('password'),
                                })
                              : null,
                            source === 'env'
                              ? jsx(TextField, { jsx, label: '环境变量名',
                                  value: row.passwordEnv,
                                  placeholder: 'DSH_SSH_PROD_PASSWORD',
                                  hint: '该变量须存在于 dsh web 进程的环境中',
                                  onChange: edit('passwordEnv'),
                                })
                              : null,
                            source === 'file'
                              ? jsx(TextField, { jsx, label: '密码文件',
                                  value: row.passwordFile,
                                  placeholder: '~/.ssh/prod.pass',
                                  hint: '文件权限建议 0600',
                                  onChange: edit('passwordFile'),
                                })
                              : null,
                          ],
                        })
                      : null,
                  ],
                }),
                problems.length > 0
                  ? jsx('p', { className: 'dssError', children: problems.join('；') })
                  : null,
                jsxs('div', {
                  className: 'dssFoot',
                  children: [
                    jsx(Button, { jsx, variant: 'primary',
                      disabled: state.saving || problems.length > 0,
                      onClick: () => void actions.save(index),
                      children: state.savedIndex === index ? '已保存' : '保存这台主机',
                    }),
                    jsx(Button, { jsx, variant: 'danger',
                      disabled: state.saving,
                      onClick: () => void actions.remove(index),
                      children: '删除',
                    }),
                    jsx('span', {
                      className: 'dssFootNote',
                      children: state.message === '' ? '保存后立即生效，无需重启' : state.message,
                    }),
                  ],
                }),
              ],
            })
          : null,
      ],
    })
  }

  /** The whole settings page. */
  return function SshHostsSettings(props) {
    const initial = props.initial
    const [state, setState] = react.useState(
      initial === undefined
        ? {
            status: 'loading',
            rows: [],
            revision: undefined,
            open: [],
            saving: false,
            savedIndex: -1,
            message: '',
            error: '',
          }
        : {
            status: 'ready',
            rows: initial.hosts.map(hostRow),
            revision: initial.revision,
            open: initial.open ?? [],
            saving: false,
            savedIndex: -1,
            message: '',
            error: '',
          },
    )

    const reload = react.useCallback(async () => {
      try {
        const loaded = await props.load()
        setState((previous) => ({
          ...previous,
          status: 'ready',
          rows: loaded.hosts.map(hostRow),
          revision: loaded.revision,
          error: '',
        }))
      } catch (error) {
        setState((previous) => ({
          ...previous,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        }))
      }
    }, [props])

    react.useEffect(() => {
      void reload()
    }, [reload])

    const actions = {
      edit: (index, field, value) =>
        setState((previous) => ({
          ...previous,
          rows: previous.rows.map((row, position) => (position === index ? { ...row, [field]: value } : row)),
          savedIndex: -1,
          message: '',
        })),
      toggle: (index) =>
        setState((previous) => ({
          ...previous,
          open: previous.open.includes(index)
            ? previous.open.filter((entry) => entry !== index)
            : [...previous.open, index],
        })),
      remove: async (index) => {
        setState((previous) => ({ ...previous, saving: true, message: '', error: '' }))
        try {
          const rows = state.rows.filter((_, position) => position !== index).map(toStoredHost)
          await props.save(rows, state.revision)
          setState((previous) => ({
            ...previous,
            saving: false,
            open: previous.open.filter((entry) => entry !== index).map((entry) => (entry > index ? entry - 1 : entry)),
            message: '已删除',
          }))
          await reload()
        } catch (error) {
          setState((previous) => ({
            ...previous,
            saving: false,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      },
      save: async (index) => {
        setState((previous) => ({ ...previous, saving: true, message: '', error: '' }))
        try {
          const rows = state.rows.map(toStoredHost)
          await props.save(rows, state.revision)
          setState((previous) => ({ ...previous, saving: false, savedIndex: index, message: '已保存，配置已生效' }))
          await reload()
        } catch (error) {
          setState((previous) => ({
            ...previous,
            saving: false,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      },
    }

    if (state.status === 'loading') {
      return jsx('div', { className: 'dssRoot', children: jsx('p', { className: 'dssHint', children: '读取配置…' }) })
    }
    if (state.status === 'error') {
      return jsx('div', {
        className: 'dssRoot',
        children: jsx('p', { className: 'dssError', children: `读取失败：${state.error}` }),
      })
    }

    return jsxs('div', {
      className: 'dssRoot',
      children: [
        jsxs('div', {
          className: 'dssSet',
          children: [
            jsxs('div', {
              className: 'dssSetHead',
              children: [
                jsx('h2', { className: 'dssSetTitle', children: 'SSH 主机' }),
                jsx('p', {
                  className: 'dssSetIntro',
                  children:
                    '模型只能连接这里列出的主机，按别名调用。改完点「保存这台主机」即生效，无需重启；也可以直接编辑 profile 的 cordis.patch.yml，两处是同一份配置。',
                }),
              ],
            }),
            state.rows.length === 0
              ? jsxs('div', {
                  className: 'dssEmpty',
                  children: [
                    jsx('p', { className: 'dssEmptyTitle', children: '还没有主机' }),
                    jsx('p', { className: 'dssHint', children: '点下面「添加主机」填写别名、地址与认证方式，保存后即可用 ssh_exec 调用。' }),
                    jsx(Button, { jsx, variant: 'primary',
                      onClick: () =>
                        setState((previous) => ({
                          ...previous,
                          rows: [...previous.rows, emptyHost()],
                          open: [...previous.open, previous.rows.length],
                        })),
                      children: '添加主机',
                    }),
                  ],
                })
              : jsxs('ul', {
                  className: 'dssSetList',
                  children: state.rows.map((row, index) =>
                    jsx(HostCard, { jsxs, row, index, state, actions }, index)
                  ),
                }),
            state.rows.length > 0
              ? jsx(Button, { jsx, onClick: () =>
                    setState((previous) => ({
                      ...previous,
                      rows: [...previous.rows, emptyHost()],
                      open: [...previous.open, previous.rows.length],
                    })),
                  children: '添加主机',
                })
              : null,
            state.error === '' ? null : jsx('p', { className: 'dssError', children: state.error }),
          ],
        }),
      ],
    })
  }
}

/** Turn a form row into the stored shape, dropping empty fields. */
export function toStoredHost(row) {
  const stored = {}
  for (const field of HOST_FIELDS) {
    const value = row[field]
    if (value === '' || value === undefined) continue
    stored[field] = field === 'port' ? Number(value) : value
  }
  return stored
}
