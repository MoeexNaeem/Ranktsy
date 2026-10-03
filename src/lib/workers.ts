import { cpus } from 'node:os'

/**
 * How many PM2 workers share this server, and therefore every per-second API
 * budget (Etsy per key, Google per account). PM2 hands each worker its app
 * config as env (`instances`); the PM2_INSTANCES override wins. Falls back to
 * cores - 1, the ecosystem.config.js default. Server-only.
 */
export function workerCount(): number {
  const n = Number(process.env.PM2_INSTANCES) || Number(process.env.instances)
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  return Math.max(1, (cpus().length || 1) - 1)
}
