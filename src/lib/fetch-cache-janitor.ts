import { opendir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Keeps Next's on-disk fetch cache bounded.
 *
 * Etsy reads use `next: { revalidate: 1800 }`, so Next writes every distinct Etsy
 * response to `<distDir>/cache/fetch-cache` and NEVER deletes an expired file (it
 * only overwrites one when the exact same request repeats). With hundreds of
 * thousands of distinct Etsy requests a day that folder reached 169 GB and nearly
 * filled the server disk (2026-10-01).
 *
 * Entries older than MAX_AGE are useless (they went stale after 30 minutes), so
 * deleting them loses nothing but disk. The folder then holds roughly the last
 * couple of hours of responses. Runs in ONE PM2 worker only, streaming the
 * directory so millions of files never sit in memory.
 */
const MAX_AGE_MS = Number(process.env.FETCH_CACHE_MAX_AGE_MIN ?? 120) * 60_000
const EVERY_MS = 20 * 60_000

async function sweep(dir: string): Promise<void> {
  const cutoff = Date.now() - MAX_AGE_MS
  let removed = 0, kept = 0
  try {
    const d = await opendir(dir)
    for await (const ent of d) {
      if (!ent.isFile()) continue
      const p = join(dir, ent.name)
      try {
        const s = await stat(p)
        if (s.mtimeMs < cutoff) { await unlink(p); removed++ } else kept++
      } catch { /* raced with Next rewriting it: skip */ }
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') console.error('[fetch-cache] sweep failed:', e)
    return
  }
  if (removed) console.info(`[fetch-cache] removed ${removed} stale entries, kept ${kept}`)
}

export function startFetchCacheJanitor(): void {
  // PM2 cluster numbers workers 0..N-1; only the first one sweeps.
  // Outside PM2 (single process) NODE_APP_INSTANCE is unset and it simply runs.
  const instance = process.env.NODE_APP_INSTANCE ?? '0'
  if (instance !== '0') return
  const dir = join(process.cwd(), process.env.NEXT_DIST_DIR || '.next', 'cache', 'fetch-cache')
  let running = false
  const run = () => {
    if (running) return
    running = true
    void sweep(dir).finally(() => { running = false })
  }
  setTimeout(run, 60_000).unref()          // first pass a minute after boot
  setInterval(run, EVERY_MS).unref()
}
