import { gzip, gunzip } from 'node:zlib'
import { promisify } from 'node:util'

/**
 * Keyword-cache rows hold a whole Keyword Search package (~87 KB of JSON). Stored
 * gzip-compressed it is ~19 KB: the collection is ~5x smaller and, because every
 * write is also copied into Atlas's 24-hour oplog, the oplog shrinks too. The JSON
 * round-trip is lossless, so what users see is byte-for-byte the same.
 */
const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

export async function packCache(data: unknown): Promise<Buffer> {
  return gzipAsync(Buffer.from(JSON.stringify(data)), { level: 6 })
}

/** Unpack a row: the compressed `dataZ`, or an older uncompressed `data`. */
export async function unpackCache<T>(row: { dataZ?: unknown; data?: unknown }): Promise<T | null> {
  if (row.dataZ) {
    // lean() hands back a BSON Binary, a find() a Buffer; accept both.
    const z = row.dataZ as { buffer?: ArrayBufferLike } | Buffer
    const buf = Buffer.isBuffer(z) ? z : Buffer.from((z as { buffer: ArrayBufferLike }).buffer)
    return JSON.parse((await gunzipAsync(buf)).toString('utf8')) as T
  }
  return (row.data as T) ?? null
}
