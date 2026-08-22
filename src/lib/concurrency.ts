/**
 * Small concurrency primitives for load resilience. Both are per-process
 * (in-memory) - which is exactly where a burst lands on a single instance, and
 * fail-safe on multi-instance (each instance protects itself). No dependencies.
 */

// ─── Single-flight (request coalescing) ───────────────────────────────────────
// De-dupes concurrent identical async work: if N callers ask for the same `key`
// while one call is in flight, they all await that ONE promise instead of each
// hammering the upstream (Etsy/Google/DB). Classic "thundering herd" guard for
// viral keywords. The entry is removed as soon as the promise settles, so this
// never caches results - it only collapses *in-flight* duplicates.
const inflight = new Map<string, Promise<unknown>>()

export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const p = (async () => fn())().finally(() => { inflight.delete(key) })
  inflight.set(key, p)
  return p
}

// ─── Semaphore (concurrency cap) ──────────────────────────────────────────────
// Caps how many of an expensive operation run at once on this instance. Excess
// callers queue (FIFO) and proceed as slots free up - so a spike of, say, image
// generations is smoothed into a steady stream rather than a burst that trips
// the provider's rate limit. `acquire()` resolves with a `release` function.
export interface Limiter {
  run<T>(fn: () => Promise<T>): Promise<T>
  active(): number
  queued(): number
}

export function createLimiter(maxConcurrent: number): Limiter {
  const max = Math.max(1, maxConcurrent)
  let active = 0
  const queue: (() => void)[] = []

  const next = () => {
    if (active >= max) return
    const start = queue.shift()
    if (start) { active++; start() }
  }

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = () => {
          Promise.resolve()
            .then(fn)
            .then(resolve, reject)
            .finally(() => { active--; next() })
        }
        queue.push(start)
        next()
      })
    },
    active: () => active,
    queued: () => queue.length,
  }
}
