/**
 * OpenSSH client process plumbing: bounded output collection, process-group
 * termination and the timeout/abort aware runner.
 */
import { spawn } from 'node:child_process'

/** Bounded byte collector: keeps draining after the cap so the child can exit. */
function createCollector(limit) {
  const chunks = []
  let bytes = 0
  let truncated = false
  return {
    push(chunk) {
      if (bytes >= limit) {
        truncated = true
        return
      }
      const room = limit - bytes
      if (chunk.length > room) {
        chunks.push(chunk.subarray(0, room))
        bytes = limit
        truncated = true
        return
      }
      chunks.push(chunk)
      bytes += chunk.length
    },
    done() {
      return { text: Buffer.concat(chunks, bytes).toString('utf8'), bytes, truncated }
    },
  }
}

/** Grace period between killing the client and giving up on its pipes. */
const KILL_GRACE_MS = 1500

/**
 * Terminate the client and its process group. A killed `ssh` may leave a
 * ProxyCommand child or a remote-side helper holding the stdio pipes open, so a
 * group kill plus {@link KILL_GRACE_MS} keeps callers from waiting on them.
 */
function killChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } catch {
      /* fall back to the direct kill below */
    }
  } else if (typeof child.pid === 'number') {
    try {
      process.kill(-child.pid, 'SIGKILL')
      return
    } catch {
      /* not a group leader; fall through */
    }
  }
  try {
    child.kill('SIGKILL')
  } catch {
    try {
      child.kill()
    } catch {
      /* the process is already gone */
    }
  }
}

/**
 * Run one OpenSSH client process and capture a bounded result.
 * @returns exit code, signal, stdout, stderr, truncation flags and duration.
 */
function runClient(command, args, options) {
  const { env, timeoutMs, signal, maxOutputBytes, onChunk } = options
  return new Promise((settle, fail) => {
    let child
    try {
      child = spawn(command, args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        // A separate process group lets us reap ProxyCommand children and
        // keeps the client away from the harness terminal.
        detached: process.platform !== 'win32',
      })
    } catch (error) {
      fail(new Error(`cannot start "${command}": ${error instanceof Error ? error.message : String(error)}`))
      return
    }
    const startedAt = Date.now()
    const stdout = createCollector(maxOutputBytes)
    const stderr = createCollector(maxOutputBytes)
    let exitCode = -1
    let exitSignal = ''
    let timedOut = false
    let aborted = false
    let spawnError
    let settled = false
    let killTimer
    const timeoutTimer = setTimeout(() => interrupt(true), timeoutMs)

    const cleanup = () => {
      clearTimeout(timeoutTimer)
      clearTimeout(killTimer)
      if (signal !== undefined) signal.removeEventListener('abort', onAbort)
    }
    const succeed = (outcome) => {
      if (settled) return
      settled = true
      cleanup()
      settle(outcome)
    }
    const failWith = (error) => {
      if (settled) return
      settled = true
      cleanup()
      fail(error)
    }
    const dropPipes = () => {
      child.stdout?.destroy()
      child.stderr?.destroy()
    }
    const buildOutcome = () => {
      const out = stdout.done()
      const err = stderr.done()
      return {
        exitCode,
        signal: exitSignal,
        stdout: out.text,
        stderr: err.text,
        truncatedStdout: out.truncated,
        truncatedStderr: err.truncated,
        durationMs: Date.now() - startedAt,
        timedOut,
      }
    }
    function interrupt(markTimedOut) {
      if (settled) return
      if (markTimedOut) timedOut = true
      killChild(child)
      if (killTimer === undefined) {
        killTimer = setTimeout(() => {
          dropPipes()
          succeed(buildOutcome())
        }, KILL_GRACE_MS)
      }
    }
    function onAbort() {
      aborted = true
      killChild(child)
      dropPipes()
      failWith(new Error('aborted'))
    }

    if (signal !== undefined) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
    child.stdout?.on('data', (chunk) => {
      stdout.push(chunk)
      onChunk?.('stdout', chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr.push(chunk)
      onChunk?.('stderr', chunk)
    })
    child.on('error', (error) => {
      spawnError = new Error(
        `cannot start "${command}": ${error instanceof Error ? error.message : String(error)}`,
      )
    })
    child.on('exit', (code, closeSignal) => {
      exitCode = typeof code === 'number' ? code : -1
      exitSignal = typeof closeSignal === 'string' ? closeSignal : ''
    })
    child.on('close', (code, closeSignal) => {
      if (exitSignal === '' && typeof closeSignal === 'string') exitSignal = closeSignal
      if (exitCode === -1 && typeof code === 'number') exitCode = code
      if (spawnError !== undefined) {
        failWith(spawnError)
        return
      }
      if (aborted) {
        failWith(new Error('aborted'))
        return
      }
      succeed(buildOutcome())
    })
  })
}

export { KILL_GRACE_MS, createCollector, killChild, runClient }
