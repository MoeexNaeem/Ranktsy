import mongoose from 'mongoose'
import dns from 'node:dns'
import dnsp from 'node:dns/promises'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in your .env.local file')
}

// `mongodb+srv://` requires SRV + TXT DNS records to be resolved before connecting.
// On some networks the default resolver times out on these (`queryTxt ETIMEOUT`),
// which makes the MongoDB driver hard-fail and blocks ALL database access — login,
// signup and the keyword cache. Point Node's c-ares resolver at reliable public DNS
// (does not affect the OS getaddrinfo used by `fetch`, so Etsy calls are unchanged).
try {
  dns.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4'])
} catch { /* some runtimes disallow setServers — ignore */ }

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
  } catch { /* TXT unavailable — the driver discovers the replica set from the seeds */ }

  const dbPath = u.pathname && u.pathname !== '/' ? u.pathname : ''
  // username/password are already percent-encoded by URL — reuse verbatim.
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
      maxPoolSize: 10,         // connection pool
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      family: 4,               // prefer IPv4 — avoids stalls on broken IPv6 setups
    }))
  }

  try {
    cached.conn = await cached.promise
  } catch (err) {
    cached.promise = null
    throw err
  }

  return cached.conn
}
