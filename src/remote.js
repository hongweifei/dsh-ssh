/**
 * Remote command construction per host operating system.
 *
 * A Windows host's default shell is `cmd.exe`, not a POSIX shell: `&&` works,
 * but POSIX utilities, single quotes and permission bits do not exist. Linux and
 * macOS both run a POSIX shell, and they share the same command syntax, so the
 * only difference the plugin has to honour is that macOS keeps file modes while
 * Windows has none.
 */
import { detectHostOs } from './detect.js'
import { remoteShellQuote } from './openssh.js'

/** Whether the host runs Windows OpenSSH with `cmd.exe` as its login shell. */
export function isWindows(host) {
  return host.os === 'windows'
}

/**
 * Resolve the operating system of one host.
 *
 * A host configured with `linux`, `macos` or `windows` uses that value as
 * given. A host left on `auto` is probed once and the result is remembered, so
 * later calls cost nothing. When the probe cannot tell, the host is treated as
 * `linux`, which is the behaviour every other setting keeps.
 *
 * @param config - the plugin's live config.
 * @param host - the host to resolve.
 * @param connection - the resolved connection for that host.
 * @param detector - the per-plugin cache of detected operating systems.
 * @returns the host with a definite `os` value.
 */
export async function resolveHostOs(config, host, connection, detector) {
  if (host.os !== 'auto') return host
  const known = detector.get(host)
  if (known !== undefined) return { ...host, os: known }
  const detected = await detectHostOs(config, host, connection)
  const os = detected ?? 'linux'
  detector.set(host, os)
  return { ...host, os }
}

/**
 * Quote a path for the host's shell: POSIX single quotes on Linux, double
 * quotes on Windows, where the shell is `cmd.exe`.
 */
export function quoteForHost(host, value) {
  if (!isWindows(host)) return remoteShellQuote(value)
  return `"${String(value).replace(/"/g, '""')}"`
}

/**
 * Build the command that applies a file mode on the host.
 *
 * Windows has no POSIX permission bits, so there is nothing to apply: the
 * caller learns this from `supported` and reports the mode as not applicable
 * instead of running a command that would fail. A request without a mode
 * produces no command at all.
 *
 * Linux and macOS both use `chmod`; the `--` separator is the POSIX
 * end-of-options marker, which GNU coreutils and BSD `chmod` both accept, and
 * it keeps a path that starts with a dash from being read as an option.
 */
export function chmodCommand(host, mode, remotePath) {
  if (mode === '') {
    return { supported: false, command: undefined }
  }
  if (isWindows(host)) {
    return { supported: false, command: undefined }
  }
  return { supported: true, command: `chmod ${mode} -- ${remoteShellQuote(remotePath)}` }
}
