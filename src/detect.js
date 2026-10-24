/**
 * Automatic host operating-system detection.
 *
 * One probe separates the three shells the plugin supports:
 *
 * - `cmd.exe` (Windows): `uname` does not exist, so the fallback branch runs
 *   and prints `NO_UNAME`.
 * - `Linux`: `uname -s` prints `Linux`.
 * - `macOS`: `uname -s` prints `Darwin`.
 *
 * The command is valid syntax in all three shells. `2>/dev/null` is not
 * understood by `cmd.exe`, where it is read as a file name, but the `||`
 * fallback still runs there, so the probe never fails on any of them.
 */
import { runClient } from './process.js'

/** The probe: valid in `cmd.exe` and in POSIX shells, with different results. */
export const DETECT_COMMAND = '(uname -s 2>/dev/null || echo NO_UNAME)'

/** The value `cmd.exe` produces, because `uname` is missing there. */
const NO_UNAME = 'NO_UNAME'

/** The value `uname -s` produces on macOS. */
const DARWIN = 'Darwin'

/**
 * Read the operating system out of a probe run.
 * @param stdout - the probe's standard output.
 * @returns 'windows', 'macos', 'linux', or undefined when the output is
 * inconclusive.
 */
export function detectFromOutput(stdout) {
  const text = String(stdout ?? '')
  if (text.includes(NO_UNAME)) return 'windows'
  if (text.includes(DARWIN)) return 'macos'
  if (/\bLinux\b/.test(text)) return 'linux'
  return undefined
}

/**
 * Detect one host's operating system by running the probe.
 * @param config - the plugin's live config.
 * @param host - the host to probe.
 * @param connection - the resolved connection (credentials and environment).
 * @returns 'windows', 'macos', 'linux', or undefined when detection failed.
 */
export async function detectHostOs(config, host, connection) {
  const result = await runClient(
    config.sshPath,
    [
      ...(host.port === 22 ? [] : ['-p', String(host.port)]),
      '-o',
      `ConnectTimeout=${host.connectTimeoutSec}`,
      '-o',
      `StrictHostKeyChecking=${host.strictHostKeyChecking}`,
      ...(host.knownHostsFile === undefined
        ? []
        : ['-o', `UserKnownHostsFile=${host.knownHostsFile}`]),
      ...(host.identityFile === undefined
        ? []
        : ['-i', host.identityFile, '-o', 'IdentitiesOnly=yes']),
      ...(host.username === undefined ? [] : [`${host.username}@${host.hostname}`]),
      DETECT_COMMAND,
    ],
    {
      env: connection.env,
      timeoutMs: host.connectTimeoutSec * 1000,
      maxOutputBytes: 4096,
    },
  )
  return detectFromOutput(result.stdout)
}

/**
 * Keep the detected operating system per host, so the probe runs once.
 */
export function createOsDetector() {
  const detected = new Map()
  return {
    /** The detected value for a host, if it was probed already. */
    get(host) {
      return detected.get(host.name)
    },
    /** Record a detection result. */
    set(host, os) {
      detected.set(host.name, os)
      return os
    },
    /** Whether a host was probed already. */
    has(host) {
      return detected.has(host.name)
    },
  }
}
