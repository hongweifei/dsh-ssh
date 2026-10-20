/**
 * In-memory live activity log for the sidebar terminal view.
 *
 * Every SSH call the tools start appends a `start` event, streams output chunks
 * while it runs, and appends an `end` event with the exit code. The log is a
 * bounded ring buffer owned by the plugin instance: it is presentation state, not
 * session truth, so it may be dropped on reload without losing anything durable.
 */

/** Events kept for late subscribers and reconnects. */
const DEFAULT_LIMIT = 400

/**
 * Create one bounded, subscribable activity log.
 * @param root0 - options.
 * @param root0.limit - maximum retained events (oldest dropped first).
 */
export function createLiveLog({ limit = DEFAULT_LIMIT } = {}) {
  const events = []
  const listeners = new Set()
  let seq = 0

  /** Append one event and fan it out to subscribers. */
  function push(event) {
    const entry = { seq: (seq += 1), at: Date.now(), ...event }
    events.push(entry)
    if (events.length > limit) events.splice(0, events.length - limit)
    for (const listener of listeners) {
      try {
        listener(entry)
      } catch {
        /* a broken subscriber must not break the tool call */
      }
    }
    return entry
  }

  return {
    push,
    /** Every retained event, oldest first. */
    snapshot: () => events.slice(),
    /** Subscribe to new events; returns the disposer. */
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Current sequence number (used by the client's reconnect marker). */
    get seq() {
      return seq
    },
  }
}

/**
 * One tool call's view of the activity log: a start event, streamed chunks, and
 * a final event carrying the outcome.
 * @param live - the plugin's activity log (may be undefined in headless setups).
 * @param detail - what the call is doing: host, tool name and a short label.
 */
export function startActivity(live, { host, tool, detail }) {
  const startedAt = Date.now()
  let seq
  if (live !== undefined) {
    seq = live.push({ kind: 'start', host, tool, detail }).seq
  }
  return {
    chunk(stream, text) {
      if (live === undefined || text === '') return
      live.push({ kind: 'chunk', host, tool, detail, seq, stream, text })
    },
    end(result) {
      if (live === undefined) return
      live.push({
        kind: 'end',
        host,
        tool,
        detail,
        seq,
        exitCode: result?.exitCode,
        timedOut: result?.timedOut === true,
        signal: result?.signal ?? '',
        truncated: result?.truncatedStdout === true || result?.truncatedStderr === true,
        durationMs: Date.now() - startedAt,
        // stderr is useful context in the viewer even when the call succeeded.
        text: (result?.stderr ?? '').trim().slice(0, 2000),
      })
    },
    fail(error) {
      if (live === undefined) return
      live.push({
        kind: 'end',
        host,
        tool,
        detail,
        seq,
        exitCode: null,
        failed: true,
        durationMs: Date.now() - startedAt,
        text: error instanceof Error ? error.message : String(error),
      })
    },
  }
}
