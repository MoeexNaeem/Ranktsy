/**
 * PM2 process manager config — this is what keeps the site UP under load.
 *
 * A bare `next start` is a SINGLE Node process on a SINGLE CPU core with no
 * restart policy: one traffic burst saturates that core, or one crash/OOM takes
 * the whole site down until someone restarts it by hand. PM2 fixes both:
 *
 *   • cluster mode  -> one worker per CPU core, all sharing port 3000. N cores =
 *                      ~N× the request capacity for this I/O-bound app.
 *   • autorestart   -> a crashed worker is replaced in milliseconds; the site
 *                      stays up while it happens (the other workers serve).
 *   • max_memory_restart -> recycle a worker BEFORE it can OOM and take the box
 *                           down; the leak (if any) never accumulates.
 *
 * Run it:
 *   npm run build
 *   pm2 start ecosystem.config.js
 *   pm2 save                 # persist across reboots
 *   pm2 startup              # (one-time) generate the boot script it prints
 *
 * Watch it:
 *   pm2 status               # workers, restarts, memory, CPU
 *   pm2 logs rankkw          # live logs incl. the [boot]/[uncaughtException] lines
 *
 * NOTE ON CLUSTERING + Etsy tokens: with multiple workers the in-memory
 * rate-limit / cache / single-flight are per-worker. That's fine for caches
 * (harmless duplication) and rate limits (slightly more lenient). The one thing
 * that wants cross-worker coordination is the Etsy token refresh (single-use
 * refresh tokens) — a shared Redis/Mongo lock closes that. See SCALING.md. Until
 * then any collision is intermittent and self-heals on the next request.
 */
const os = require('os')

module.exports = {
  apps: [
    {
      name: 'rankkw',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      exec_mode: 'cluster',
      // One worker per core MINUS ONE, so nginx and the OS always have a core
      // (on the 4-core / 3.5 GB server, 4 workers left nothing spare, 2026-10-03).
      // Override with the PM2_INSTANCES env var.
      instances: process.env.PM2_INSTANCES || Math.max(1, os.cpus().length - 1),
      autorestart: true,
      // Make V8 collect garbage BEFORE PM2's limit. Without a heap limit Node lets
      // the heap grow to ~2 GB, so every worker climbed to PM2's ceiling and was
      // killed (30-51 restarts each, each restart a 100% CPU reload), 2026-10-03.
      node_args: `--max-old-space-size=${process.env.NODE_HEAP_MB || 640}`,
      // Last-resort recycle, above the heap limit plus Next's non-heap memory.
      // 3 workers x 900M stays inside the 3.5 GB box.
      max_memory_restart: process.env.PM2_MAX_MEMORY || '900M',
      // Back off if a worker crash-loops, instead of hammering restarts.
      exp_backoff_restart_delay: 200,
      // Give in-flight requests time to finish on reload/restart.
      kill_timeout: 8000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
      },
    },
  ],
}
