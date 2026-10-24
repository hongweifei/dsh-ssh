/**
 * dsh-ssh — remote command execution and file transfer for DeepSeek Harness.
 *
 * Design notes
 * - Zero runtime dependencies beyond the config schema: the transport is the
 *   system OpenSSH client (`ssh`, `scp`), so the plugin runs on Linux, macOS and
 *   Windows 10+ with nothing installed, and it inherits the user's keys,
 *   ssh-agent and `~/.ssh/config` entries.
 * - Hosts are a whitelist: every call names an alias declared in this plugin's
 *   config, so no other destination can be reached through these tools.
 * - Password / key-passphrase authentication uses `SSH_ASKPASS` together with
 *   `SSH_ASKPASS_REQUIRE=force` (OpenSSH 8.4+). The secret only ever travels in
 *   the child process environment - never in argv, never in a tool result.
 *
 * Module layout
 *   src/config.js      raw config -> normalized hosts (+ warnings)
 *   src/process.js     OpenSSH client process plumbing: bounded, cancellable
 *   src/connection.js  credentials and the SSH_ASKPASS helper
 *   src/openssh.js     ssh/scp argument construction and host lookup
 *   src/settings.js    Config schema rendered by the Harness settings panel
 *   src/live.js        in-memory activity log feeding the live panel
 *   src/route.js       same-origin SSE endpoint for the live panel
 *   src/tools/*.js     one file per model-facing tool
 */
import { createAskpass } from './src/connection.js'
import { readConfig } from './src/config.js'
import { createOsDetector } from './src/detect.js'
import { createLiveLog } from './src/live.js'
import { liveRoute } from './src/route.js'
import { sshDownloadTool } from './src/tools/download.js'
import { sshExecTool } from './src/tools/exec.js'
import { sshHostsTool } from './src/tools/hosts.js'
import { sshUploadTool } from './src/tools/upload.js'
import { Config } from './src/settings.js'

/** Cordis plugin name. */
export const name = 'dsh-ssh'

/** Services required to register the remote tools. */
export const inject = ['tools']

/**
 * Config schema: the Harness settings form and the profile YAML are two views of
 * the same row config, validated by this schema.
 */
export { Config }

/**
 * Register the SSH tools for this profile.
 * @param ctx - Cordis context carrying the tool registry.
 * @param raw - plugin config from the profile patch layer.
 */
export function apply(ctx, raw) {
  // Every config field is volatile, so the settings panel can change hosts while
  // the plugin runs. Tools therefore read the live config per call instead of
  // capturing it here.
  const getConfig = () => readConfig(raw)
  const askpass = createAskpass(() => getConfig().config.askpassPath)
  const live = createLiveLog()
  const detector = createOsDetector()
  ctx.effect(() => askpass.cleanup)
  ctx.effect(() => {
    const disposers = [
      ctx.tools.register(sshHostsTool(getConfig, detector)),
      ctx.tools.register(sshExecTool(getConfig, askpass, live, detector)),
      ctx.tools.register(sshUploadTool(getConfig, askpass, live, detector)),
      ctx.tools.register(sshDownloadTool(getConfig, askpass, live, detector)),
    ]
    return () => {
      for (const dispose of disposers) dispose()
    }
  })
  // The live panel needs the web carrier; the tools themselves do not.
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register(liveRoute(live)))
  })
}
