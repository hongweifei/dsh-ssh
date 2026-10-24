/**
 * The client entry of the plugin.
 *
 * The Harness loads a client module as a single bundle through its own module
 * loader, so this file is bundled into `client.js` by `build-client.mjs`. The
 * pages themselves live in `src/client/`, one file per page, so the settings
 * form and the terminal view can be read and changed independently.
 *
 * A client module runs inside the page: `react` and the Harness services come
 * from the loader, no Harness client package is imported, and every colour
 * comes from the theme tokens, so both pages follow the active theme.
 *
 * The bundle is built so that it assigns its exports to a global name; the
 * loader shell in `bundle-template.js` then reads them from there.
 */
import { CSS } from './css.js'
import { jsx, jsxs } from './jsx.js'
import { setJsxFactory } from './shared.js'
import { createSettingsPage } from './settings.js'
import { createTerminalPage } from './terminal.js'

/**
 * Build the client module.
 * @param react - the React runtime from the module loader.
 * @returns the client module exports.
 */
export function install(react) {
  setJsxFactory(jsx)
  /** Tab kind; the pane body and title slots are keyed by it. */
  const KIND = 'ssh-live'

  const tagId = 'dsh-ssh/ui.css'
  if (typeof document !== 'undefined' && document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-ssh'
    tag.dataset.pluginCss = tagId
    tag.textContent = CSS
    document.head.appendChild(tag)
  }

  const SshHostsSettings = createSettingsPage(jsx, jsxs, react)
  const SshTerminal = createTerminalPage(jsx, jsxs, react)

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
        jsx('rect', { key: 'rect', x: 1.2, y: 2.2, width: 13.6, height: 11.6, rx: 3, stroke: 'currentColor', strokeWidth: 1.2 }),
        jsx('path', { key: 'prompt', d: 'M4.6 6.2 6.6 8l-2 1.8', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        jsx('path', { key: 'line', d: 'M8.4 10h3', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
      ],
    })
  }

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

  return {
    apply,
    inject: ['slots', 'remote', 'remote.settings', 'sidebarRight', 'sidebarRightTabs'],
    // The page components, exposed so a render harness can mount them.
    pages: { SshHostsSettings, SshTerminal },
  }
}
