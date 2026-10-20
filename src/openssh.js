/**
 * OpenSSH argument construction: shared ssh/scp options, destinations, remote
 * path quoting and host lookup.
 */
import { expandHome } from './config.js'

/** Quote a string for the *remote* shell (used by ssh command lines). */
function remoteShellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

/**
 * Format the remote half of an `scp destination`. OpenSSH 9 and later `scp`
 * speaks SFTP by default, where the path never reaches a remote shell, so any
 * quoting would become part of the file name; only the legacy rcp protocol
 * expands the path in a shell. `scpMode: legacy` therefore quotes it.
 */
function remotePathArgument(config, remotePath) {
  return config.scpMode === 'legacy' ? remoteShellQuote(remotePath) : remotePath
}

/**
 * Shared `ssh`/`scp` options. `interactive` keeps password prompting enabled;
 * otherwise BatchMode stops a missing key from hanging on a terminal prompt.
 */
function commonArgs(host, interactive, portFlag) {
  const args = []
  if (host.port !== 22) args.push(portFlag, String(host.port))
  if (host.identityFile !== undefined) {
    args.push('-i', expandHome(host.identityFile), '-o', 'IdentitiesOnly=yes')
  }
  args.push('-o', `ConnectTimeout=${host.connectTimeoutSec}`)
  args.push('-o', `StrictHostKeyChecking=${host.strictHostKeyChecking}`)
  if (host.knownHostsFile !== undefined) {
    args.push('-o', `UserKnownHostsFile=${expandHome(host.knownHostsFile)}`)
  }
  if (!interactive) args.push('-o', 'BatchMode=yes')
  for (const option of host.extraOptions) args.push('-o', option)
  return args
}

function destinationOf(host) {
  return host.username === undefined ? host.hostname : `${host.username}@${host.hostname}`
}

function requireHost(config, alias) {
  const host = config.hosts.find((candidate) => candidate.name === alias)
  if (host === undefined) {
    const known = config.hosts.map((candidate) => candidate.name).join(', ')
    throw new Error(
      `unknown host "${String(alias)}"; configured aliases: ${known === '' ? '(none)' : known}. ` +
        'Add it under the dsh-ssh entries "hosts" list in the profile cordis.patch.yml, or call ssh_hosts.',
    )
  }
  return host
}

export { remoteShellQuote, remotePathArgument, commonArgs, destinationOf, requireHost }
