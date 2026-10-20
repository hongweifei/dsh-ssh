/**
 * The live SSE endpoint behind the sidebar terminal view.
 *
 * One same-origin route streams the retained activity snapshot and then every new
 * event, so a panel opened mid-run immediately shows what the model is doing and
 * then follows it in real time. The route carries presentation data only; tools
 * never read from it.
 */

/** Route path served by this plugin. */
export const LIVE_PATH = '/plugins/dsh-ssh/live'

/** Heartbeat interval keeping idle proxies from closing the stream. */
const KEEP_ALIVE_MS = 15_000

/**
 * Build the `webServer.register` route description for one activity log.
 * @param live - the plugin's activity log.
 */
export function liveRoute(live) {
  return {
    kind: 'exact',
    path: LIVE_PATH,
    handler(req, res) {
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end()
        return
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`)
      res.write('retry: 2000\n\n')
      for (const event of live.snapshot()) send(event)
      const unsubscribe = live.subscribe(send)
      const keepAlive = setInterval(() => res.write(': ping\n\n'), KEEP_ALIVE_MS)
      const close = () => {
        clearInterval(keepAlive)
        unsubscribe()
      }
      req.on('close', close)
      res.on('close', close)
    },
  }
}
