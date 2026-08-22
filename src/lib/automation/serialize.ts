import type { IAutomationRun } from '@/lib/models'

/** Shape an AutomationRun for the client (ids as strings, item summary + counts). */
export function serializeRun(run: IAutomationRun & { _id: unknown }) {
  const items = (run.items ?? []).map(i => ({
    idx: i.idx, keyword: i.keyword, status: i.status,
    title: i.title ?? null, tags: i.tags ?? [], description: i.description ?? null,
    price: i.price ?? null, listingId: i.listingId ?? null, listingUrl: i.listingUrl ?? null, error: i.error ?? null,
  }))
  const done = items.filter(i => i.status === 'done').length
  const errored = items.filter(i => i.status === 'error').length
  return {
    id: String(run._id),
    status: run.status,
    mode: run.mode, geo: run.geo, publishToEtsy: run.publishToEtsy,
    total: items.length, done, errored,
    items,
    createdAt: run.createdAt ?? null,
  }
}
