/**
 * Node.js-only crash visibility (imported by instrumentation.ts ONLY when
 * NEXT_RUNTIME === 'nodejs', so process.* never reaches the Edge bundle).
 *
 * Runs as a side effect on import: in PRODUCTION it logs unhandled rejections and
 * uncaught exceptions (with a stack + timestamp) so "the site went down and I
 * don't know why" is impossible, then exits on an uncaught error so the process
 * supervisor (PM2) recycles a fresh, clean worker.
 */
export {} // ensure this file is treated as a module (it's otherwise side-effect only)

if (process.env.NODE_ENV === 'production') {
  process.on('unhandledRejection', (reason: unknown) => {
    const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
    console.error(`[unhandledRejection] ${new Date().toISOString()}\n${detail}`)
  })

  process.on('uncaughtException', (err: Error) => {
    console.error(`[uncaughtException] ${new Date().toISOString()}\n${err.stack ?? err.message}`)
    // Flush the log, then hand over to the supervisor for a clean restart.
    setTimeout(() => process.exit(1), 150)
  })

  console.log(`[boot] worker up · pid ${process.pid} · ${new Date().toISOString()}`)
}
