/**
 * Persistent shell sessions.
 *
 * A one-shot `ssh host <command>` pays for TCP, key exchange and password
 * authentication on every call, and it forgets the working directory and
 * environment between calls. A session keeps one authenticated `ssh` process
 * alive and feeds it commands over stdin, which removes the repeated handshake
 * and makes `cd` / `set` behave like a real login shell.
 *
 * Framing
 * - Windows: the remote side runs `cmd.exe /q` (no command echo). Each call
 *   writes the command line and then `echo <marker>:%ERRORLEVEL%`; `cmd`
 *   expands the variable when it executes that second line, so the marker
 *   carries the command's real exit code.
 * - POSIX: the login shell reads commands from stdin. Each call writes the
 *   command and then `printf '\n<marker>:%s\n' "$?"`.
 * - The marker is a per-session random token, so remote output cannot collide
 *   with it by accident. stdout is framed by the marker; stderr travels on
 *   ssh's own stderr stream and is collected for the same call window, with a
 *   short flush grace after the marker arrives.
 *
 * Cancellation
 * A shell blocked inside a command cannot be interrupted reliably through a
 * pipe (Windows has no signal channel), so a timeout kills the whole `ssh`
 * process. The session is marked closed and the next call opens a fresh one;
 * the state of the old shell is lost, which the tool result reports.
 */
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { decodeOutput } from './encoding.js'
import { commonArgs, destinationOf } from './openssh.js'
import { killChild } from './process.js'

/** How long the remote shell may take to announce readiness. */
const READY_TIMEOUT_MS = 25_000
/** Bytes of the previous chunk kept to find a marker split across chunks. */
const SCAN_TAIL = 64
/** Wait this long after the end marker so stderr flushed late still lands here. */
const STDERR_GRACE_MS = 150
/** Default time an idle session is kept alive. */
const DEFAULT_IDLE_MS = 300_000
/** Cap on the banner/readiness buffer. */
const OPEN_BUFFER_LIMIT = 262_144

/** Raised when a shell cannot be started, so the caller can fall back. */
class SessionUnavailable extends Error {
  constructor(message) {
    super(message)
    this.name = 'SessionUnavailable'
    this.unavailable = true
  }
}

/**
 * Remove `cmd`'s prompt from the captured stdout. `cmd` prints a CRLF and then
 * the prompt after each command line, so the CRLF goes with the prompt.
 */
function stripPrompt(text, marker) {
  if (marker === '' || !text.includes(marker)) return text
  return text
    .split(`\r\n${marker}`)
    .join('')
    .split(`\n${marker}`)
    .join('')
    .split(marker)
    .join('')
}

/** Raised when the shell went away while a call was running. */
class SessionLost extends Error {
  constructor(message) {
    super(message)
    this.name = 'SessionLost'
  }
}

/**
 * Collect one stream of one call: display bytes bounded by the cap, and a
 * rolling tail so a marker still gets found after the cap was reached.
 */
class CallCollector {
  constructor(limit) {
    this.limit = limit
    this.chunks = []
    this.bytes = 0
    this.truncated = false
    this.scanTail = Buffer.alloc(0)
  }

  /** Append raw bytes (the part before the marker when one was located). */
  push(chunk, keepLength) {
    const length = keepLength === undefined ? chunk.length : keepLength
    if (length <= 0) return
    if (this.bytes >= this.limit) {
      this.truncated = true
      return
    }
    const room = this.limit - this.bytes
    if (length > room) {
      this.chunks.push(chunk.subarray(0, room))
      this.bytes = this.limit
      this.truncated = true
      return
    }
    this.chunks.push(chunk.subarray(0, length))
    this.bytes += length
  }

  /** Drop bytes already collected: the marker started inside the previous chunk. */
  trimBack(count) {
    let remaining = count
    while (remaining > 0 && this.chunks.length > 0) {
      const last = this.chunks[this.chunks.length - 1]
      if (last.length <= remaining) {
        this.chunks.pop()
        this.bytes -= last.length
        remaining -= last.length
      } else {
        this.chunks[this.chunks.length - 1] = last.subarray(0, last.length - remaining)
        this.bytes -= remaining
        remaining = 0
      }
    }
  }

  /** Track the tail used for cross-chunk marker detection. */
  track(chunk) {
    const combined = Buffer.concat([this.scanTail, chunk])
    this.scanTail = combined.subarray(Math.max(0, combined.length - SCAN_TAIL))
    return combined
  }

  buffer(encoding) {
    return decodeOutput(Buffer.concat(this.chunks, this.bytes), encoding)
  }
}

/** One authenticated shell process for one host. */
class ShellSession {
  constructor({ host, connection, sshPath, encoding = 'auto', maxOutputBytes, idleMs = DEFAULT_IDLE_MS, onClosed }) {
    this.host = host
    this.connection = connection
    this.sshPath = sshPath
    this.encoding = encoding
    this.maxOutputBytes = maxOutputBytes
    this.idleMs = idleMs
    this.onClosed = onClosed
    this.windows = host.os === 'windows'
    this.token = randomBytes(6).toString('hex')
    this.promptMarker = `__DSH_P_${this.token}__`
    this.readyMarker = `__DSH_R_${this.token}__`
    this.mode = 'opening'
    this.child = undefined
    this.active = undefined
    this.seq = 0
    this.chain = Promise.resolve()
    this.idleTimer = undefined
    this.readyTimer = undefined
    this.closed = false
    this.openBuffer = Buffer.alloc(0)
    this.openStderr = []
    this.liveCarry = Buffer.alloc(0)
    this.readySettle = undefined
    this.readyFail = undefined
  }

  /** The argv that opens the shell. */
  argv() {
    const args = [...commonArgs(this.host, this.connection.interactive, '-p'), destinationOf(this.host)]
    // `cmd /q` suppresses the echo of every command line; a plain `cmd.exe`
    // echoes each command back into the output stream.
    if (this.windows) args.push('cmd /q')
    return args
  }

  /** Start the process and wait until the shell answers the readiness probe. */
  start() {
    return new Promise((resolve, reject) => {
      let child
      try {
        child = spawn(this.sshPath, this.argv(), {
          env: this.connection.env,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          detached: process.platform !== 'win32',
        })
      } catch (error) {
        reject(
          new SessionUnavailable(
            `cannot start "${this.sshPath}": ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
        return
      }
      this.child = child
      child.stdout?.on('data', (chunk) => this.onStdout(chunk))
      child.stderr?.on('data', (chunk) => this.onStderr(chunk))
      child.on('error', (error) => {
        const message = `cannot start "${this.sshPath}": ${error instanceof Error ? error.message : String(error)}`
        if (this.mode === 'opening' && this.readyFail !== undefined) this.readyFail(new SessionUnavailable(message))
        this.failPending(message)
      })
      child.on('close', (code, signal) => {
        this.closed = true
        clearTimeout(this.idleTimer)
        clearTimeout(this.readyTimer)
        const detail = this.openStderrText()
        const reason =
          `session closed (ssh exit=${code ?? -1}${signal ? ` signal=${signal}` : ''})` +
          (detail === '' ? '' : `: ${detail}`)
        if (this.mode === 'opening' && this.readyFail !== undefined) {
          this.readyFail(new SessionUnavailable(reason))
        }
        this.failPending(reason)
        this.onClosed?.(this)
      })
      this.readySettle = resolve
      this.readyFail = reject
      this.send(
        this.windows ? `prompt ${this.promptMarker}\r\necho ${this.readyMarker}\r\n` : `echo ${this.readyMarker}\n`,
      )
      this.readyTimer = setTimeout(() => {
        if (this.mode !== 'opening') return
        this.readyFail = undefined
        this.kill('readiness timeout')
        reject(new SessionUnavailable(`remote shell did not become ready within ${READY_TIMEOUT_MS}ms`))
      }, READY_TIMEOUT_MS)
    })
  }

  openStderrText() {
    return decodeOutput(Buffer.concat(this.openStderr), 'auto').text.replace(/[\r\n]+/g, ' ').trim().slice(0, 300)
  }

  send(text) {
    if (this.child?.stdin === undefined || this.child.stdin.destroyed || this.closed) return
    try {
      this.child.stdin.write(text)
    } catch {
      /* the close handler reports the failure */
    }
  }

  onStdout(chunk) {
    if (this.mode === 'opening') {
      this.openBuffer = Buffer.concat([this.openBuffer, chunk])
      const at = this.openBuffer.indexOf(this.readyMarker)
      if (at >= 0) {
        clearTimeout(this.readyTimer)
        this.openBuffer = Buffer.alloc(0)
        this.mode = 'idle'
        this.scheduleIdle()
        this.readySettle?.()
        this.readySettle = undefined
        this.readyFail = undefined
      } else if (this.openBuffer.length > OPEN_BUFFER_LIMIT) {
        this.openBuffer = this.openBuffer.subarray(this.openBuffer.length - OPEN_BUFFER_LIMIT)
      }
      return
    }
    const call = this.active
    if (this.mode !== 'running' || call === undefined || call.settled) return
    const tailLength = call.stdout.scanTail.length
    const combined = call.stdout.track(chunk)
    const at = combined.indexOf(call.marker)
    if (at >= 0) {
      // Keep only the bytes of this chunk that lie before the marker start; the
      // marker may have started inside the previous chunk's tail, in which case
      // those already-collected bytes are dropped as well.
      const overlap = Math.max(0, tailLength - at)
      const keep = Math.max(0, Math.min(chunk.length, at - tailLength))
      if (overlap > 0) call.stdout.trimBack(overlap)
      call.stdout.push(chunk, keep)
      const digits = /^\s*(\d+)/.exec(combined.subarray(at + call.marker.length).toString('latin1'))
      if (digits !== null) call.exitCode = Number(digits[1])
      this.emitLive('stdout', chunk.subarray(0, keep), call)
      this.finishCall(call)
      return
    }
    call.stdout.push(chunk)
    this.emitLive('stdout', chunk, call)
  }

  /**
   * Forward stdout bytes to the live panel without `cmd`'s prompt marker.
   * A marker can be split across chunks, so a suffix that could be the start of
   * one is held back; the leftover (a prompt fragment) is dropped at the next
   * call instead of being shown.
   */
  emitLive(stream, chunk, call) {
    if (call?.onChunk === undefined) return
    if (stream === 'stderr' || !this.windows) {
      call.onChunk(stream, chunk)
      return
    }
    const data = this.liveCarry.length === 0 ? chunk : Buffer.concat([this.liveCarry, chunk])
    const text = data.toString('latin1').split(this.promptMarker).join('')
    let hold = 0
    const max = Math.min(text.length, this.promptMarker.length - 1)
    for (let length = max; length > 0; length -= 1) {
      if (this.promptMarker.startsWith(text.slice(text.length - length))) {
        hold = length
        break
      }
    }
    this.liveCarry = Buffer.from(text.slice(text.length - hold), 'latin1')
    const emit = text.slice(0, text.length - hold)
    if (emit !== '') call.onChunk('stdout', Buffer.from(emit, 'latin1'))
  }

  onStderr(chunk) {
    if (this.mode === 'opening') {
      if (this.openStderr.length < 64) this.openStderr.push(chunk)
      return
    }
    const call = this.active
    if (this.mode !== 'running' || call === undefined) return
    call.stderr.push(chunk)
    call.onChunk?.('stderr', chunk)
  }

  /** Settle the running call: stop collecting, wait the stderr grace, resolve. */
  finishCall(call) {
    if (call.settled) return
    call.settled = true
    clearTimeout(call.timer)
    call.finishTimer = setTimeout(() => this.settleCall(call), STDERR_GRACE_MS)
  }

  settleCall(call) {
    if (this.active === call) this.active = undefined
    // Resolve even when the shell died during the stderr grace window: the
    // bytes already collected are the honest result of the call.
    if (!this.closed) {
      this.mode = 'idle'
      this.scheduleIdle()
    }
    call.resolve({
      exitCode: call.exitCode,
      signal: '',
      ...this.collect(call),
      durationMs: Date.now() - call.startedAt,
      timedOut: false,
    })
  }

  collect(call) {
    const out = call.stdout.buffer(this.encoding)
    const err = call.stderr.buffer(this.encoding)
    return {
      // `cmd` writes a CRLF and then the prompt after every command line; the
      // CRLF belongs to the prompt, not to the command's output.
      stdout: stripPrompt(out.text, this.promptMarker),
      stderr: err.text,
      truncatedStdout: call.stdout.truncated,
      truncatedStderr: call.stderr.truncated,
      stdoutEncoding: out.encoding,
      stderrEncoding: err.encoding,
    }
  }

  scheduleIdle() {
    clearTimeout(this.idleTimer)
    if (this.idleMs <= 0) return
    this.idleTimer = setTimeout(() => this.kill('idle timeout'), this.idleMs)
    this.idleTimer.unref?.()
  }

  /** Run one command in this shell. Calls are serialized: a shell has one stdin. */
  run(command, options) {
    const execute = () => this.execute(command, options)
    const result = this.chain.then(execute, execute)
    this.chain = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  execute(command, { timeoutMs, signal, onChunk }) {
    if (this.closed || this.child === undefined) {
      const lost = new SessionLost('session is closed')
      // Nothing was sent yet, so the manager may safely retry on a new shell.
      lost.beforeSend = true
      return Promise.reject(lost)
    }
    if (signal?.aborted) return Promise.reject(new Error('aborted'))
    if (this.windows && /[\r\n]/.test(command)) {
      return Promise.reject(
        new Error(
          'ssh_exec: a Windows persistent session runs single-line commands only; ' +
            'join steps with "&" or set "fresh": true to run a multi-line script over a one-shot connection',
        ),
      )
    }
    clearTimeout(this.idleTimer)
    this.mode = 'running'
    this.liveCarry = Buffer.alloc(0)
    this.seq += 1
    const marker = `${this.windows ? '' : '\n'}__DSH_E_${this.token}_${this.seq}__`
    const call = {
      startedAt: Date.now(),
      marker: Buffer.from(`${marker}:`, 'latin1'),
      stdout: new CallCollector(this.maxOutputBytes),
      stderr: new CallCollector(this.maxOutputBytes),
      exitCode: -1,
      settled: false,
      timer: undefined,
      finishTimer: undefined,
      onChunk,
      onAbort: undefined,
      resolve: undefined,
      reject: undefined,
    }
    const result = new Promise((resolve, reject) => {
      call.resolve = resolve
      call.reject = reject
    })
    this.active = call
    call.timer = setTimeout(() => this.timeoutCall(call, timeoutMs), timeoutMs)
    if (signal !== undefined) {
      call.onAbort = () => this.abortCall(call)
      if (signal.aborted) {
        this.abortCall(call)
        return result
      }
      signal.addEventListener('abort', call.onAbort, { once: true })
    }
    const cleanup = () => {
      if (call.onAbort !== undefined) signal?.removeEventListener('abort', call.onAbort)
    }
    result.then(cleanup, cleanup)
    this.send(this.windows ? `${command}\r\n` : `${command}\n`)
    this.send(this.windows ? `echo ${marker}:%ERRORLEVEL%\r\n` : `printf '${marker}:%s\\n' "$?"\n`)
    return result
  }

  timeoutCall(call, timeoutMs) {
    if (call.settled) return
    call.settled = true
    clearTimeout(call.timer)
    const outcome = this.collect(call)
    call.resolve({
      exitCode: -1,
      signal: 'SIGKILL',
      ...outcome,
      durationMs: Date.now() - call.startedAt,
      timedOut: true,
      sessionReset: true,
    })
    this.kill(`command timed out after ${timeoutMs}ms`)
  }

  abortCall(call) {
    if (call.settled) return
    call.settled = true
    clearTimeout(call.timer)
    call.reject(new Error('aborted'))
    this.kill('aborted')
  }

  /** Fail the running call because the shell is gone. */
  failPending(message) {
    const call = this.active
    if (call === undefined || call.settled) return
    call.settled = true
    clearTimeout(call.timer)
    const detail = (call.stderr.buffer(this.encoding).text || call.stdout.buffer(this.encoding).text).trim().slice(0, 300)
    call.reject(new SessionLost(detail === '' ? message : `${message}; ${detail}`))
  }

  /** Close the process. Idempotent. */
  kill(reason = 'closed') {
    if (this.closed) return
    this.closed = true
    clearTimeout(this.idleTimer)
    clearTimeout(this.readyTimer)
    this.failPending(reason)
    if (this.child !== undefined) {
      try {
        this.child.stdin?.end()
      } catch {
        /* already gone */
      }
      killChild(this.child)
    }
  }
}

/**
 * Own the persistent shells of this plugin instance, one per host alias.
 * @param options - live config accessor and the askpass helper.
 */
export function createSessionManager({ getConfig }) {
  const sessions = new Map()

  function signatureOf(host) {
    return [host.hostname, host.port, host.username ?? '', host.auth, host.identityFile ?? '', host.os].join('|')
  }

  function discard(name) {
    const existing = sessions.get(name)
    if (existing === undefined) return
    sessions.delete(name)
    existing.session.kill('config changed')
  }

  /**
   * Register a new shell synchronously and start it in the background.
   *
   * Registering before `await start()` is what stops two concurrent first
   * calls from each opening their own shell: the second call finds the entry
   * (with its `ready` promise) and waits on it.
   */
  function createEntry(config, host, connection) {
    const session = new ShellSession({
      host,
      connection,
      sshPath: config.sshPath,
      encoding: config.remoteEncoding,
      maxOutputBytes: config.maxOutputBytes,
      idleMs: config.sessionIdleMs,
      onClosed: (closed) => {
        const current = sessions.get(host.name)
        if (current !== undefined && current.session === closed) sessions.delete(host.name)
      },
    })
    const entry = { session, signature: signatureOf(host), ready: undefined }
    sessions.set(host.name, entry)
    entry.ready = session.start().catch((error) => {
      const current = sessions.get(host.name)
      if (current !== undefined && current.session === session) sessions.delete(host.name)
      session.kill('start failed')
      throw error instanceof SessionUnavailable
        ? error
        : new SessionUnavailable(error instanceof Error ? error.message : String(error))
    })
    // A discarded entry may reject before anyone observes it.
    entry.ready.catch(() => {})
    return entry
  }

  return {
    /**
     * Run a command in the host's shell, opening it on first use.
     * @throws SessionUnavailable when no shell could be opened.
     */
    async run(host, connection, command, options) {
      const { config } = getConfig()
      if (config.sessionMode === 'off') throw new SessionUnavailable('persistent sessions are disabled')
      const startedAt = Date.now()
      let entry = sessions.get(host.name)
      if (entry !== undefined && (entry.signature !== signatureOf(host) || entry.session.closed)) {
        discard(host.name)
        entry = undefined
      }
      if (entry === undefined) entry = createEntry(config, host, connection)
      await entry.ready
      try {
        const result = await entry.session.run(command, options)
        return { ...result, durationMs: Date.now() - startedAt }
      } catch (error) {
        // A queued call can find its shell already gone (for example the
        // previous call timed out). Nothing was sent, so retry once on a fresh
        // shell instead of failing the command.
        if (error?.beforeSend !== true) throw error
        discard(host.name)
        entry = createEntry(config, host, connection)
        await entry.ready
        const result = await entry.session.run(command, options)
        return { ...result, durationMs: Date.now() - startedAt }
      }
    },
    /** Whether a warm shell exists for this host: '' | 'idle' | 'running'. */
    state(name) {
      const entry = sessions.get(name)
      if (entry === undefined || entry.session.closed) return ''
      return entry.session.mode === 'running' ? 'running' : 'idle'
    },
    /** Close one host's shell. */
    close(name) {
      discard(name)
    },
    /** Close every shell, e.g. on plugin unload. */
    closeAll() {
      for (const name of [...sessions.keys()]) discard(name)
    },
  }
}

export { ShellSession, SessionUnavailable, SessionLost, DEFAULT_IDLE_MS }
