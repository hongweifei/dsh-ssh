/**
 * Credentials for one host: where the password / key passphrase comes from, the
 * SSH_ASKPASS helper that hands it to OpenSSH, and the environment assembly.
 */
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expandHome } from './config.js'

const ASKPASS_ENV = 'DSH_SSH_SECRET'
/** Resolve the password / key passphrase from the environment or a file. */
function resolveSecret(host) {
  if (host.passwordEnv !== undefined) {
    const value = process.env[host.passwordEnv]
    if (value === undefined || value === '') {
      throw new Error(
        `host "${host.name}": environment variable ${host.passwordEnv} is unset or empty; ` +
          'start the harness with it set, or use passwordFile instead',
      )
    }
    return value
  }
  if (host.passwordFile !== undefined) {
    const file = expandHome(host.passwordFile)
    if (!existsSync(file)) {
      throw new Error(`host "${host.name}": passwordFile ${file} does not exist`)
    }
    return readFileSync(file, 'utf8').replace(/[\r\n]+$/, '')
  }
  return undefined
}

/**
 * Prepare the `SSH_ASKPASS` helper. It reads the secret from the child process
 * environment, so the secret never reaches disk or argv.
 */
function createAskpass(config) {
  let directory
  let script
  const cleanup = () => {
    if (directory !== undefined) {
      try {
        rmSync(directory, { recursive: true, force: true })
      } catch {
        /* best effort */
      }
      directory = undefined
      script = undefined
    }
  }
  const write = (fileName, content) => {
    directory = mkdtempSync(join(tmpdir(), 'dsh-ssh-askpass-'))
    script = join(directory, fileName)
    writeFileSync(script, content, { mode: 0o700 })
    try {
      chmodSync(script, 0o700)
    } catch {
      /* Windows and exotic filesystems ignore file modes */
    }
    return script
  }
  return {
    async pathFor(hostName) {
      if (config.askpassPath !== undefined) return config.askpassPath
      if (script !== undefined) return script
      if (process.platform === 'win32') {
        const node = process.execPath
        return write(
          'askpass.cmd',
          `@echo off\r\n"${node}" -e "process.stdout.write(process.env.${ASKPASS_ENV}||'')"\r\n`,
        )
      }
      if (process.platform === 'darwin' || process.platform === 'linux') {
        return write('askpass.sh', `#!/bin/sh\nprintf '%s\\n' "$${ASKPASS_ENV}"\n`)
      }
      throw new Error(
        `host "${hostName}": password authentication needs an askpass helper on ${process.platform}; ` +
          'set the plugin config "askpassPath" to an executable that prints the secret, or use auth "key"/"agent"',
      )
    },
    cleanup,
  }
}

/** Environment for one client process, carrying the secret out of band. */
function childEnv(secret, askpassPath) {
  const env = { ...process.env }
  delete env[ASKPASS_ENV]
  if (secret === undefined) {
    delete env.SSH_ASKPASS
    delete env.SSH_ASKPASS_REQUIRE
    return env
  }
  env[ASKPASS_ENV] = secret
  env.SSH_ASKPASS = askpassPath
  env.SSH_ASKPASS_REQUIRE = 'force'
  if (env.DISPLAY === undefined) env.DISPLAY = 'dsh-ssh:0'
  return env
}
/** Resolve host credentials plus the askpass helper for one call. */
async function connectionFor(host, askpass) {
  if (host.auth === 'password' && host.passwordEnv === undefined && host.passwordFile === undefined) {
    throw new Error(
      `host "${host.name}": auth "password" requires passwordEnv or passwordFile; ` +
        'put the secret in an environment variable or a 0600 file instead of the plugin config',
    )
  }
  const secret = resolveSecret(host)
  const askpassPath = secret === undefined ? undefined : await askpass.pathFor(host.name)
  return {
    secret,
    env: childEnv(secret, askpassPath),
    interactive: secret !== undefined || host.auth === 'password',
  }
}

export { ASKPASS_ENV, resolveSecret, createAskpass, childEnv, connectionFor }
