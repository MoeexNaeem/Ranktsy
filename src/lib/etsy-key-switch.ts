/**
 * Admin on/off switch per Etsy API key (Code Flow → Etsy API quota).
 *
 * Switching a key OFF takes it out of the public-call rotation so its rolling 24h
 * quota can recover; every tool keeps working on the keys that are still ON (one
 * key off → load on the other two, two off → everything on the last one). At
 * least one key always stays on (enforced when saving, and the fetcher falls back
 * to the whole pool if the saved state ever leaves none usable).
 *
 * Keys are identified by a short hash of their keystring (never the key itself),
 * so re-ordering the env vars can't switch off the wrong key. The state lives in
 * Mongo (AppSetting `etsy-keys-disabled`) so it applies to every PM2 worker; each
 * worker reads it through a short in-process cache, refreshed in the background so
 * the Etsy hot path never waits on the database (except once, on a cold start).
 *
 * db/models are imported lazily (like etsy.ts does) so loading lib/etsy never
 * pulls in the database layer at module-evaluation time.
 */
export const ETSY_KEY_SWITCH_SETTING = 'etsy-keys-disabled'
const CACHE_MS = 5_000

export interface EtsyKeySwitchState {
  disabled: string[]     // key ids (hash) switched off
  by: string | null      // admin email who last changed it
  at: string | null      // ISO time of the last change
}

const EMPTY: EtsyKeySwitchState = { disabled: [], by: null, at: null }

// One cache per process (Next bundles this into several chunks; globalThis keeps one copy).
type Cache = { at: number; state: EtsyKeySwitchState; loaded: boolean; inflight?: Promise<EtsyKeySwitchState> }
const g = globalThis as typeof globalThis & { __rkEtsyKeySwitch?: Cache }
const cache = (): Cache => (g.__rkEtsyKeySwitch ??= { at: 0, state: EMPTY, loaded: false })

function parse(str: string | undefined): EtsyKeySwitchState {
  try {
    const j = str ? JSON.parse(str) : {}
    return {
      disabled: Array.isArray(j.disabled) ? j.disabled.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0) : [],
      by: typeof j.by === 'string' ? j.by : null,
      at: typeof j.at === 'string' ? j.at : null,
    }
  } catch {
    return EMPTY
  }
}

async function models() {
  const [{ connectDB }, { AppSetting }] = await Promise.all([import('@/lib/db'), import('@/lib/models')])
  await connectDB()
  return AppSetting
}

async function readFromDb(): Promise<EtsyKeySwitchState> {
  const AppSetting = await models()
  const doc = await AppSetting.findOne({ key: ETSY_KEY_SWITCH_SETTING }).lean<{ str?: string }>()
  return doc ? parse(doc.str) : EMPTY
}

function refresh(): Promise<EtsyKeySwitchState> {
  const c = cache()
  if (c.inflight) return c.inflight
  c.inflight = readFromDb()
    .then(state => { g.__rkEtsyKeySwitch = { at: Date.now(), state, loaded: true }; return state })
    // A DB blip keeps the LAST known state (or "all on" on a cold start): never
    // let a read error silently turn keys off.
    .catch(() => { g.__rkEtsyKeySwitch = { at: Date.now(), state: c.state, loaded: true }; return c.state })
  return c.inflight
}

/**
 * Ids of the keys switched off. Waits for the database only on this worker's first
 * call; afterwards it answers from memory and refreshes in the background when the
 * cached copy is older than CACHE_MS.
 */
export async function getDisabledEtsyKeyIds(): Promise<Set<string>> {
  const c = cache()
  if (!c.loaded) return new Set((await refresh()).disabled)
  if (Date.now() - c.at > CACHE_MS) void refresh()
  return new Set(c.state.disabled)
}

/** Same as above but never waits (for sync helpers); "all on" until first loaded. */
export function disabledEtsyKeyIdsNow(): Set<string> {
  const c = cache()
  if (!c.loaded || Date.now() - c.at > CACHE_MS) void refresh()
  return new Set(c.state.disabled)
}

/** Fresh state straight from the database (admin views). */
export async function readEtsyKeySwitch(): Promise<EtsyKeySwitchState> {
  return refresh().then(() => cache().state)
}

export class EtsyKeySwitchError extends Error {}

/**
 * Switch one key on or off. `allIds` = ids of the keys currently configured; it is
 * used to refuse switching off the last key that is on, and to drop ids of keys
 * that no longer exist. Applies to this worker immediately, others within CACHE_MS.
 */
export async function setEtsyKeyEnabled(id: string, enabled: boolean, by: string, allIds: string[]): Promise<EtsyKeySwitchState> {
  if (!allIds.includes(id)) throw new EtsyKeySwitchError('That key is not configured on the server.')
  const current = await readFromDb()
  const disabled = new Set(current.disabled.filter(x => allIds.includes(x)))
  if (enabled) disabled.delete(id)
  else disabled.add(id)
  if (allIds.every(x => disabled.has(x))) {
    throw new EtsyKeySwitchError('At least one Etsy key must stay on, otherwise every Etsy tool stops working.')
  }
  const state: EtsyKeySwitchState = { disabled: [...disabled], by, at: new Date().toISOString() }
  const AppSetting = await models()
  await AppSetting.updateOne({ key: ETSY_KEY_SWITCH_SETTING }, { $set: { str: JSON.stringify(state) } }, { upsert: true })
  g.__rkEtsyKeySwitch = { at: Date.now(), state, loaded: true }
  return state
}
