import mongoose from 'mongoose'
import dns from 'node:dns'
import dnsp from 'node:dns/promises'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in your .env.local file')
}

// `mongodb+srv://` requires SRV + TXT DNS records to be resolved before connecting.
// On some networks the default resolver times out on these (`queryTxt ETIMEOUT`),
// which makes the MongoDB driver hard-fail and blocks ALL database access - login,
// signup and the keyword cache. Point Node's c-ares resolver at reliable public DNS
// (does not affect the OS getaddrinfo used by `fetch`, so Etsy calls are unchanged).
try {
  dns.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4'])
} catch { /* some runtimes disallow setServers - ignore */ }

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('dns-timeout')), ms))])
}

// Resolve a `mongodb+srv://` URI to a plain `mongodb://` URI ourselves: we look up
// the SRV *hosts* (that query works on the affected networks) and skip the flaky TXT
// record entirely. Best-effort merges any TXT options (e.g. replicaSet); if TXT is
// unavailable the driver simply discovers the replica set from the seed hosts.
async function connectableUri(): Promise<string> {
  if (!MONGODB_URI.startsWith('mongodb+srv://')) return MONGODB_URI

  const u = new URL(MONGODB_URI)
  const host = u.hostname
  const srv = await dnsp.resolveSrv('_mongodb._tcp.' + host)
  if (!srv.length) throw new Error(`No SRV records found for ${host}`)
  const hosts = srv.map(s => `${s.name}:${s.port}`).join(',')

  const params = new URLSearchParams(u.search)
  if (!params.has('tls') && !params.has('ssl')) params.set('tls', 'true')
  if (!params.has('authSource')) params.set('authSource', 'admin')
  try {
    const txtPromise = dnsp.resolveTxt(host)
    txtPromise.catch(() => {}) // avoid unhandledRejection if the timeout wins
    const txt = (await withTimeout(txtPromise, 1500)).flat().join('&')
    new URLSearchParams(txt).forEach((v, k) => { if (!params.has(k)) params.set(k, v) })
  } catch { /* TXT unavailable - the driver discovers the replica set from the seeds */ }

  const dbPath = u.pathname && u.pathname !== '/' ? u.pathname : ''
  // username/password are already percent-encoded by URL - reuse verbatim.
  return `mongodb://${u.username}:${u.password}@${hosts}${dbPath}?${params.toString()}`
}

// Singleton: reuse connection across hot-reloads in development
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: {
    conn: typeof mongoose | null
    promise: Promise<typeof mongoose> | null
  }
}

const cached = global._mongooseCache ?? { conn: null, promise: null }
global._mongooseCache = cached

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = connectableUri().then(uri => mongoose.connect(uri, {
      bufferCommands: false,
      // Pool sizing matters at scale: on serverless each instance keeps its own
      // pool, so a burst of instances × maxPoolSize can exhaust Atlas's
      // connection cap. Keep the per-instance pool modest and release idle
      // sockets so scaled-down instances free their connections. Tune via env.
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE ?? 10),
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE ?? 0),
      maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_MS ?? 30_000), // close idle conns after 30s
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      family: 4,               // prefer IPv4 - avoids stalls on broken IPv6 setups
    }))
  }

  try {
    cached.conn = await cached.promise
  } catch (err) {
    cached.promise = null
    throw err
  }

  void reconcileTtlIndexes(cached.conn)
  void reconcileRankIndex(cached.conn)
  return cached.conn
}

// Changing a schema's TTL `expireAfterSeconds` does NOT update an already-created
// Mongo index - so if the chat/notification TTL was ever built with a shorter value
// (e.g. an old CHAT_RETENTION_DAYS), messages keep expiring early forever. This runs
// ONCE per process and uses collMod to force the live index back to RETENTION_SECONDS
// (30 days), which corrects the retention without dropping the index. Best-effort.
/**
 * Rank snapshots were once unique on (keyword, listingId, day). Rank is per
 * MARKET, so that key forced one row per listing per day across every country
 * and merged orderings that were never comparable. The key now includes
 * `country`, and the OLD unique index has to go or it blocks the second
 * country's row for the same listing and day.
 *
 * Runs once per process, best-effort: dropping an index that is already gone,
 * or on a collection that does not exist yet, is not an error worth surfacing.
 */
let rankIndexReconciled = false
async function reconcileRankIndex(conn: typeof mongoose): Promise<void> {
  if (rankIndexReconciled) return
  rankIndexReconciled = true
  const db = conn.connection.db
  if (!db) return
  try {
    const coll = db.collection('searchranksnapshots')
    const existing = await coll.indexes()
    for (const ix of existing) {
      const k = ix.key as Record<string, number>
      const isOldKey = k.keyword === 1 && k.listingId === 1 && k.day === 1 && k.country == null
      if (isOldKey && ix.unique && ix.name) await coll.dropIndex(ix.name)
    }
  } catch { /* collection or index absent, or no permission - ignore */ }
}

let ttlReconciled = false
async function reconcileTtlIndexes(conn: typeof mongoose): Promise<void> {
  if (ttlReconciled) return
  ttlReconciled = true
  const wanted = Number(process.env.CHAT_RETENTION_DAYS) > 0 ? Number(process.env.CHAT_RETENTION_DAYS) : 30
  const seconds = wanted * 86400
  const db = conn.connection.db
  if (!db) return
  for (const coll of ['chatmessages', 'notifications']) {
    try {
      await db.command({ collMod: coll, index: { keyPattern: { createdAt: 1 }, expireAfterSeconds: seconds } })
    } catch { /* index/collection not present yet, or command unsupported - ignore */ }
  }
}
