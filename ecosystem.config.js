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

// Sized from the machine it runs on, so moving to a bigger server needs no edits
// (2026-10-06: 4 cores / 3.6 GB -> 8 cores / 23 GB). Each env var still overrides.
const INSTANCES = Number(process.env.PM2_INSTANCES) || Math.max(1, os.cpus().length - 1)
const TOTAL_MB = Math.floor(os.totalmem() / 1024 / 1024)
// Leave ~1.5 GB (or a quarter of RAM) for the OS, nginx and a build, split the rest
// across the workers: ~70% of each share is V8 heap, the rest is Next's native memory.
const SHARE_MB = Math.floor((TOTAL_MB - Math.max(1536, TOTAL_MB / 4)) / INSTANCES)
const HEAP_MB = Number(process.env.NODE_HEAP_MB) || Math.max(512, Math.min(2048, Math.floor(SHARE_MB * 0.7)))
const MAX_MEMORY = process.env.PM2_MAX_MEMORY || `${Math.max(800, Math.min(2600, Math.floor(SHARE_MB * 0.95)))}M`

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
      instances: INSTANCES,
      autorestart: true,
      // Make V8 collect garbage BEFORE PM2's limit. Without a heap limit Node lets
      // the heap grow to ~2 GB, so every worker climbed to PM2's ceiling and was
      // killed (30-51 restarts each, each restart a 100% CPU reload), 2026-10-03.
      // 4-core/3.6 GB box: 640 MB. 8-core/23 GB box: 2048 MB (see HEAP_MB above).
      node_args: `--max-old-space-size=${HEAP_MB}`,
      // Last-resort recycle, above the heap limit plus Next's non-heap memory.
      max_memory_restart: MAX_MEMORY,
      // Back off if a worker crash-loops, instead of hammering restarts.
      exp_backoff_restart_delay: 200,
      // Give in-flight requests time to finish on reload/restart.
      kill_timeout: 8000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        // The app paces Etsy and Google per worker from this (lib/workers.ts): every
        // worker shares the same per-second API budgets.
        PM2_INSTANCES: String(INSTANCES),
      },
    },
  ],
}
