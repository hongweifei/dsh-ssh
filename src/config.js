/**
 * Config normalization: turn the raw Loader row config into the shape the tools
 * use, collecting human-readable warnings instead of throwing on bad rows.
 */
import { homedir } from 'node:os'
import { join, resolve as resolvePath } from 'node:path'

const AUTH_KINDS = new Set(['agent', 'key', 'password'])
const STRICT_KINDS = new Set(['accept-new', 'yes', 'no', 'ask'])
const SCP_MODES = new Set(['sftp', 'legacy'])
const DEFAULT_COMMAND_TIMEOUT_MS = 60_000
const DEFAULT_CONNECT_TIMEOUT_SEC = 15
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024
/** Expand a leading `~` so paths work without a shell. */
function expandHome(value) {
  if (typeof value !== 'string' || value === '') return value
  if (value === '~') return homedir()
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(homedir(), value.slice(2))
  return value
}

/** Local paths go straight into argv, so make them absolute and `~`-free. */
function resolveLocal(value) {
  return resolvePath(expandHome(value))
}

/** Accept only positive finite numbers. */
function positiveInt(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback
}

/** Read an optional non-empty string field. */
function optionalString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/**
 * Accept `strictHostKeyChecking` as a keyword or as the boolean YAML 1.1 turns
 * `yes`/`no`/`on`/`off` into, so an unquoted `no` does not silently become the
 * default.
 */
function strictHostKeyCheckingOf(value, fallback) {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return STRICT_KINDS.has(value) ? value : fallback
}

function normalizeHost(entry, index, config, warnings, seen) {
  const label = `hosts[${index}]`
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    warnings.push(`${label} must be a mapping; skipped`)
    return undefined
  }
  const alias = optionalString(entry.name)
  if (alias === undefined) {
    warnings.push(`${label}.name is required; skipped`)
    return undefined
  }
  if (seen.has(alias)) {
    warnings.push(`${label}.name "${alias}" duplicates an earlier host; skipped`)
    return undefined
  }
  if (entry.auth !== undefined && !AUTH_KINDS.has(entry.auth)) {
    warnings.push(`${label}.auth "${String(entry.auth)}" is not agent|key|password; using "agent"`)
  }
  const extraOptions = []
  if (entry.extraOptions !== undefined) {
    if (Array.isArray(entry.extraOptions)) {
      for (const option of entry.extraOptions) {
        if (typeof option === 'string' && option.trim() !== '' && !/[\r\n]/.test(option)) extraOptions.push(option.trim())
        else warnings.push(`${label}.extraOptions entries must be single-line strings; ignored one`)
      }
    } else {
      warnings.push(`${label}.extraOptions must be a list of "Key=Value" strings; ignored`)
    }
  }
  return {
    name: alias,
    // A host entry without `host` uses the alias itself, which makes an
    // existing `~/.ssh/config` alias directly usable.
    hostname: optionalString(entry.host) ?? alias,
    port: positiveInt(entry.port, 22),
    username: optionalString(entry.username),
    description: typeof entry.description === 'string' ? entry.description : '',
    auth: AUTH_KINDS.has(entry.auth) ? entry.auth : 'agent',
    identityFile: optionalString(entry.identityFile),
    password: optionalString(entry.password),
    passwordEnv: optionalString(entry.passwordEnv),
    passwordFile: optionalString(entry.passwordFile),
    knownHostsFile: optionalString(entry.knownHostsFile),
    strictHostKeyChecking: strictHostKeyCheckingOf(entry.strictHostKeyChecking, config.strictHostKeyChecking),
    extraOptions,
    connectTimeoutSec: positiveInt(entry.connectTimeoutSec, config.connectTimeoutSec),
    commandTimeoutMs: positiveInt(entry.commandTimeoutMs, config.commandTimeoutMs),
  }
}

/** Merge raw plugin config with defaults and drop unusable host rows. */
function normalizeConfig(raw) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const warnings = []
  const config = {
    sshPath: optionalString(source.sshPath) ?? 'ssh',
    scpPath: optionalString(source.scpPath) ?? 'scp',
    askpassPath: optionalString(source.askpassPath),
    commandTimeoutMs: positiveInt(source.commandTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS),
    connectTimeoutSec: positiveInt(source.connectTimeoutSec, DEFAULT_CONNECT_TIMEOUT_SEC),
    maxOutputBytes: positiveInt(source.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES),
    scpMode: SCP_MODES.has(source.scpMode) ? source.scpMode : 'sftp',
    strictHostKeyChecking: strictHostKeyCheckingOf(source.strictHostKeyChecking, 'accept-new'),
    hosts: [],
  }
  if (source.askpassPath !== undefined && config.askpassPath !== undefined) {
    config.askpassPath = expandHome(config.askpassPath)
  }
  if (source.hosts === undefined) {
    warnings.push('no hosts configured')
  } else if (!Array.isArray(source.hosts)) {
    warnings.push('config.hosts must be a list; ignored')
  } else {
    const seen = new Set()
    for (const [index, entry] of source.hosts.entries()) {
      const host = normalizeHost(entry, index, config, warnings, seen)
      if (host !== undefined) {
        config.hosts.push(host)
        seen.add(host.name)
      }
    }
  }
  return { config, warnings }
}

/**
 * Read one config field as it stands right now.
 *
 * Every schema field is `volatile`, so the Harness hands `apply` a reactive
 * reference per field and refreshes it when the settings panel saves, without
 * remounting the plugin. Reading through this helper keeps plain values working
 * too, which is what direct construction and tests pass in.
 */
function liveValue(source, field) {
  const value = source === null || typeof source !== 'object' ? undefined : source[field]
  return value !== null && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value
}

/**
 * Normalize the live configuration.
 * @param source - the plugin's config object, volatile references included.
 */
export function readConfig(source) {
  return normalizeConfig({
    hosts: liveValue(source, 'hosts'),
    commandTimeoutMs: liveValue(source, 'commandTimeoutMs'),
    connectTimeoutSec: liveValue(source, 'connectTimeoutSec'),
    maxOutputBytes: liveValue(source, 'maxOutputBytes'),
    scpMode: liveValue(source, 'scpMode'),
    sshPath: liveValue(source, 'sshPath'),
    scpPath: liveValue(source, 'scpPath'),
    strictHostKeyChecking: liveValue(source, 'strictHostKeyChecking'),
    askpassPath: liveValue(source, 'askpassPath'),
  })
}

export {
  AUTH_KINDS,
  STRICT_KINDS,
  SCP_MODES,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_CONNECT_TIMEOUT_SEC,
  DEFAULT_MAX_OUTPUT_BYTES,
  expandHome,
  resolveLocal,
  positiveInt,
  optionalString,
  strictHostKeyCheckingOf,
  normalizeHost,
  normalizeConfig,
}
