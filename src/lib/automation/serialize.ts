import type { IAutomationRun } from '@/lib/models'

/** Shape an AutomationRun for the client (ids as strings, full item listing + counts). */
export function serializeRun(run: IAutomationRun & { _id: unknown }) {
  const items = (run.items ?? []).map(i => ({
    idx: i.idx, keyword: i.keyword, status: i.status,
    title: i.title ?? null, tags: i.tags ?? [], description: i.description ?? null,
    price: i.price ?? null, currency: i.currency ?? null,
    listingId: i.listingId ?? null, listingUrl: i.listingUrl ?? null, error: i.error ?? null,
    hint: i.hint ?? null, fromPhotos: !!i.fromPhotos,
    imageCount: i.imageCount ?? 0, fileCount: i.fileCount ?? 0,
    imagesUploaded: i.imagesUploaded ?? 0, filesUploaded: i.filesUploaded ?? 0,
    taxonomyId: i.taxonomyId ?? null, taxonomyPath: i.taxonomyPath ?? null,
    materials: i.materials ?? [], styles: i.styles ?? [], altText: i.altText ?? null,
    attributes: (i.attributes ?? []).map(a => ({ propertyId: a.propertyId, name: a.name, values: a.values ?? [] })),
    sku: i.sku ?? null,
    warnings: i.warnings ?? [],
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
