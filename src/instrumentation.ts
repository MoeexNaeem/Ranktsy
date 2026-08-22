/**
 * Next.js startup hook (runs once per server process, before handling requests).
 *
 * Its job here is CRASH VISIBILITY. Until now an uncaught error or an unhandled
 * promise rejection could take the whole Node process down with nothing written
 * to the logs, so "the site went down and I don't know why" was unavoidable.
 *
 * - unhandledRejection: log it (with time + reason). Node would otherwise crash on
 *   these in strict mode; logging first means we always see the cause.
 * - uncaughtException: log it, then exit cleanly so the process supervisor (PM2 /
 *   systemd) restarts a FRESH process. We deliberately do NOT swallow it — a
 *   process that keeps running after an uncaught error is in an unknown, unsafe
 *   state; a fast restart is safer and, under PM2, near-instant.
 */
export async function register() {
  // Only in the Node.js server runtime (not Edge / middleware).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Guard to PRODUCTION only. In dev, Next has its own error overlay and recovers
  // from some exceptions it emits; installing an exit-on-uncaught handler there
  // would turn those into hard restarts of the dev server. Production is where we
  // want the crash logged and the supervisor to recycle the worker.
  if (process.env.NODE_ENV !== 'production') return

  process.on('unhandledRejection', (reason: unknown) => {
    const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
    console.error(`[unhandledRejection] ${new Date().toISOString()}\n${detail}`)
  })

  process.on('uncaughtException', (err: Error) => {
    console.error(`[uncaughtException] ${new Date().toISOString()}\n${err.stack ?? err.message}`)
    // Flush the log, then hand over to the supervisor for a clean restart.
    setTimeout(() => process.exit(1), 150)
  })

  // A visible marker in the logs each time a worker boots — makes restart loops
  // (e.g. an OOM crash-looping) obvious at a glance.
  console.log(`[boot] worker up · pid ${process.pid} · ${new Date().toISOString()}`)
}
