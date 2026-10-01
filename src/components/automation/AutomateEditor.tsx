'use client'
// NOTE: uses reactflow v11 (NOT @xyflow/react v12). v12's node measurement does not
// fire in this Next 16 / React 19 / Turbopack stack, so handles never get bounds and
// edges never render. v11 measures natively, no workaround needed. See the sibling
// "Connect GS" project, which runs the same stack on v11 without issue.
import 'reactflow/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, BackgroundVariant,
  useNodesState, useEdgesState, addEdge, Handle, Position, useReactFlow, useStoreApi, ConnectionMode,
  type Node, type Edge, type Connection, type NodeProps,
} from 'reactflow'

/* ─────────────────────────────────────────────────────────────────────────────
   Node-based "Automate Listing" builder (admin-only for now). Each node is one
   section of Etsy's "Add a listing" form. The seller adds products (photos, plus
   the files for digital items) on the Products node; everything else is filled
   automatically from real market data, per the settings on each node. Execute
   generates one listing per product and, with a Create Draft node, creates each
   in the chosen shop as a draft and uploads its photos / files.
   ──────────────────────────────────────────────────────────────────────────── */

type NodeKind = 'products' | 'research' | 'category' | 'title' | 'description' | 'tags' | 'attributes' | 'price' | 'details' | 'delivery' | 'shop' | 'draft'
type NodeStatus = 'idle' | 'running' | 'done' | 'error'
type Cfg = Record<string, unknown>
type WFData = { kind: NodeKind; status: NodeStatus; config: Cfg; summary?: string; warn?: boolean }
type WFNode = Node<WFData>

const ORANGE = '#FB5E09'
const INK = '#1f2430'
const MUTED = '#6b7280'
const FAINT = '#8a90a0'
const LINE = '#e2e5ec'

// Connector line style. Kept deliberately dark/thick: the old #c3c8d4 was so close
// to the canvas background that the (correctly rendered) edges read as "no line".
const EDGE_STYLE = { stroke: '#7b8496', strokeWidth: 2.5 } as const

function svg(path: React.ReactNode) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
}

const DEFS: Record<NodeKind, { label: string; color: string; role?: string; icon: React.ReactNode; hint: string }> = {
  products:    { label: 'Products', color: '#6366F1', role: 'Trigger', hint: 'Your photos & files, or a niche', icon: svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-5-5L5 21" /></>) },
  research:    { label: 'Market Research', color: '#0EA5E9', hint: 'Real demand, tags, categories, prices', icon: svg(<><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>) },
  category:    { label: 'Category', color: '#F97316', hint: 'Etsy category, auto or fixed', icon: svg(<><path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2" /></>) },
  title:       { label: 'Title', color: '#8B5CF6', hint: 'Keyword-front-loaded, max 140', icon: svg(<><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></>) },
  description: { label: 'Description', color: '#14B8A6', hint: 'Persuasive, structured copy', icon: svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="14" y2="18" /></>) },
  tags:        { label: 'Tags & Materials', color: '#EC4899', hint: '13 tags, materials, styles', icon: svg(<><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></>) },
  attributes:  { label: 'Attributes', color: '#D946EF', hint: 'Craft type, Occasion, Celebration...', icon: svg(<><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h6" /><circle cx="18" cy="15" r="3" /></>) },
  price:       { label: 'Price & Inventory', color: '#22C55E', hint: 'Price, quantity, SKU', icon: svg(<><line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>) },
  details:     { label: "How It's Made", color: '#A855F7', hint: 'Physical / digital, who made it, personalization', icon: svg(<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" /></>) },
  delivery:    { label: 'Delivery', color: '#0891B2', hint: 'Shipping, processing, returns, section', icon: svg(<><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>) },
  shop:        { label: 'Shop', color: '#3B82F6', hint: 'Which connected shop to use', icon: svg(<><path d="M4 9V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4" /><path d="M3 9h18l-1.2 4a2 2 0 0 1-2 1.5H6.2a2 2 0 0 1-2-1.5L3 9z" /><path d="M5 14v6h14v-6" /></>) },
  draft:       { label: 'Create Draft', color: ORANGE, hint: 'Create drafts + upload photos & files', icon: svg(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>) },
}

const ORDER: NodeKind[] = ['products', 'research', 'category', 'title', 'description', 'tags', 'attributes', 'price', 'details', 'delivery', 'shop', 'draft']

const DEFAULTS: Record<NodeKind, Cfg> = {
  products:    { mode: 'products', niche: '', seeds: '', count: 5, geo: 'US' },
  research:    {},
  category:    { mode: 'auto', taxonomyId: '', taxonomyPath: '', taxQuery: '' },
  title:       { style: 'keyword-first', maxLength: 140, mustInclude: '' },
  description: { length: 'standard', tone: 'friendly', footer: '' },
  tags:        { focus: 'long-tail', always: '', materials: true, styles: true },
  attributes:  { mode: 'auto', fixed: {} },
  price:       { strategy: 'median', fixed: '', min: '', max: '', charm: true, quantity: 1, sku: '' },
  details:     { type: 'physical', whoMade: 'i_did', isSupply: false, whenMade: 'made_to_order', personalization: 'off', personalizationInstructions: '', personalizationMax: 256, autoRenew: true },
  delivery:    { shippingProfileId: '', readinessStateId: '', returnPolicyId: '', shopSectionId: '', weight: '', weightUnit: 'oz', length: '', width: '', height: '', dimUnit: 'in' },
  shop:        { shopId: '' },
  draft:       { uploadPhotos: true, uploadFiles: true },
}

const STATUS_RING: Record<NodeStatus, string> = { idle: 'transparent', running: ORANGE, done: '#22C55E', error: '#DC2626' }

/* ── Custom node: circular icon + label + one-line summary, with a status ring ── */
function WorkflowNode({ data, selected }: NodeProps<WFData>) {
  const def = DEFS[data.kind]
  const isSource = data.kind === 'products'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 118 }}>
      {!isSource && <Handle type="target" position={Position.Left} style={{ background: '#fff', width: 14, height: 14, border: `2.5px solid ${def.color}`, top: 32 }} />}
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: `${def.color}18`,
        border: `2px solid ${data.status !== 'idle' ? STATUS_RING[data.status] : (selected ? def.color : `${def.color}66`)}`,
        color: def.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: selected ? `0 0 0 4px ${def.color}22` : '0 4px 14px rgba(30,30,40,0.10)',
        transition: 'border-color .15s, box-shadow .15s',
        position: 'relative',
      }}>
        {def.icon}
        {data.status === 'running' && <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: `2px solid ${ORANGE}`, borderTopColor: 'transparent', animation: 'rkspin .8s linear infinite' }} />}
        {data.warn && data.status === 'idle' && <span title="Needs a setting" style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#DC2626', border: '2px solid #fff' }} />}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK, lineHeight: 1.2 }}>{def.label}</div>
        {def.role && <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: def.color, marginTop: 2 }}>{def.role}</div>}
        {data.summary && <div style={{ fontSize: 11, color: data.warn ? '#DC2626' : FAINT, marginTop: 3, lineHeight: 1.3, maxWidth: 118, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.summary}</div>}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: def.color, width: 14, height: 14, border: '2.5px solid #fff', boxShadow: `0 0 0 1.5px ${def.color}`, top: 32 }} />
      <style>{`@keyframes rkspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const nodeTypes = { wf: WorkflowNode }

let idSeq = 1
const newId = () => `n${idSeq++}`

/** The full workflow, every Etsy listing section in order, laid out in two rows. */
function fullWorkflow(): { nodes: WFNode[]; edges: Edge[] } {
  const nodes: WFNode[] = ORDER.map((kind, i) => ({
    id: kind === 'products' ? 'products' : newId(),
    type: 'wf',
    position: { x: 60 + (i % 6) * 190, y: i < 6 ? 80 : 300 },
    data: { kind, status: 'idle', config: structuredClone(DEFAULTS[kind]) },
  }))
  const edges: Edge[] = nodes.slice(1).map((n, i) => ({ id: `e-${nodes[i].id}-${n.id}`, source: nodes[i].id, target: n.id, animated: true, style: { ...EDGE_STYLE } }))
  return { nodes, edges }
}

/* ── Client-side product data (photos + files stay in the browser) ──────────── */
type Product = { id: string; hint: string; images: File[]; files: File[] }
const MAX_PRODUCTS = 25
const MAX_PHOTOS = 20
const MAX_FILES = 5
const MAX_FILE_BYTES = 20 * 1024 * 1024
// One upload per request; kept under the server's nginx body limit (6 MB).
const SAFE_UPLOAD_BYTES = 5.5 * 1024 * 1024
let pSeq = 1
const newProduct = (images: File[] = []): Product => ({ id: `p${pSeq++}`, hint: '', images, files: [] })

const isImage = (f: File) => f.type.startsWith('image/')
const fmtBytes = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

async function scaleImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * s))
    c.height = Math.max(1, Math.round(img.naturalHeight * s))
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not read this photo.'))), 'image/jpeg', quality))
  } finally {
    URL.revokeObjectURL(url)
  }
}
function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })
}
/** Small JPEG the AI looks at to identify the product. */
async function previewOf(file: File) {
  return { data: await blobToBase64(await scaleImage(file, 768, 0.8)), mimeType: 'image/jpeg' }
}
/** A photo Etsy accepts (JPG/PNG/GIF) that fits through the upload limit. */
async function uploadable(file: File): Promise<File> {
  if (['image/jpeg', 'image/png', 'image/gif'].includes(file.type) && file.size <= SAFE_UPLOAD_BYTES) return file
  for (const [dim, q] of [[3000, 0.9], [2400, 0.85], [2000, 0.8], [1600, 0.75]] as const) {
    const b = await scaleImage(file, dim, q)
    if (b.size <= SAFE_UPLOAD_BYTES) return new File([b], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  }
  throw new Error(`${file.name} is too large to upload.`)
}
async function uploadMedia(runId: string, idx: number, kind: 'image' | 'file', file: File, rank: number) {
  const fd = new FormData()
  fd.append('idx', String(idx))
  fd.append('kind', kind)
  fd.append('rank', String(rank))
  fd.append('file', file)
  const r = await fetch(`/api/automation/runs/${runId}/media`, { method: 'POST', body: fd })
  if (r.status === 413) throw new Error(`${file.name}: larger than the server upload limit (raise nginx client_max_body_size).`)
  const j = await r.json().catch(() => null)
  if (!j?.success) throw new Error(`${file.name}: ${j?.error || `upload failed (${r.status})`}`)
}

/* ── API shapes ─────────────────────────────────────────────────────────────── */
type Shop = { shopId: string; shopName: string }
type Taxonomy = { id: number; name: string; fullPath: string; level: number }
type TaxProp = { propertyId: number; name: string; required: boolean; multi: boolean; values: { id: number; name: string }[] }
type ShopOptions = { shippingProfiles: { id: number; title: string; origin: string | null }[]; processingProfiles: { id: number; label: string }[]; returnPolicies: { id: number; label: string }[]; sections: { id: number; title: string }[] }
type RunItem = {
  idx: number; keyword: string; status: string; title: string | null; tags: string[]; description: string | null
  price: number | null; currency: string | null; listingId: number | null; listingUrl: string | null; error: string | null
  hint: string | null; fromPhotos: boolean; imageCount: number; fileCount: number; imagesUploaded: number; filesUploaded: number
  taxonomyPath: string | null; materials: string[]; styles: string[]; altText: string | null
  attributes: { propertyId: number; name: string; values: string[] }[]; sku: string | null; warnings: string[]
}
type Run = { id: string; status: string; total: number; done: number; errored: number; items: RunItem[]; lastIdx?: number }
type MediaState = { img: number; imgTotal: number; file: number; fileTotal: number; busy: boolean; errors: string[] }

/* ── Small form kit ─────────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = { width: '100%', fontSize: 13.5, fontFamily: 'inherit', color: INK, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, padding: '9px 11px', outline: 'none', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }
const noteStyle: React.CSSProperties = { fontSize: 12, color: FAINT, lineHeight: 1.55, margin: 0 }

function Field({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}{note && <p style={{ ...noteStyle, marginTop: 6 }}>{note}</p>}</div>
}
function Select({ value, onChange, options }: { value: unknown; onChange: (v: string) => void; options: [string, string][] }) {
  return <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={inputStyle}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
}
function Text({ value, onChange, placeholder, numeric }: { value: unknown; onChange: (v: string) => void; placeholder?: string; numeric?: boolean }) {
  return <input value={String(value ?? '')} onChange={e => onChange(e.target.value)} placeholder={placeholder} inputMode={numeric ? 'decimal' : undefined} style={inputStyle} />
}
function Toggle({ checked, onChange, label, note }: { checked: boolean; onChange: (v: boolean) => void; label: string; note?: string }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2, accentColor: ORANGE, width: 16, height: 16 }} />
      <span><span style={{ fontSize: 13.5, color: INK, fontWeight: 500 }}>{label}</span>{note && <span style={{ display: 'block', fontSize: 12, color: FAINT, marginTop: 2, lineHeight: 1.45 }}>{note}</span>}</span>
    </label>
  )
}
function Segmented({ value, onChange, options }: { value: unknown; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(([v, l]) => {
        const on = String(value) === v
        return <button key={v} type="button" onClick={() => onChange(v)} style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: `1px solid ${on ? ORANGE : LINE}`, background: on ? `${ORANGE}12` : '#fff', color: on ? ORANGE : MUTED, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{l}</button>
      })}
    </div>
  )
}

// One object URL per File for the page's lifetime (the File is held in memory
// anyway until the run is done, and StrictMode's double effects make per-mount
// create/revoke flaky).
const thumbUrls = new WeakMap<File, string>()
function thumbUrl(file: File): string {
  let u = thumbUrls.get(file)
  if (!u) { u = URL.createObjectURL(file); thumbUrls.set(file, u) }
  return u
}

function Thumb({ file, badge, onRemove }: { file: File; badge?: string; onRemove: () => void }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#eef0f4', border: `1px solid ${LINE}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimize it */}
      <img src={thumbUrl(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {badge && <span style={{ position: 'absolute', left: 3, bottom: 3, fontSize: 9, fontWeight: 700, background: ORANGE, color: '#fff', padding: '1px 5px', borderRadius: 4 }}>{badge}</span>}
      <button type="button" onClick={onRemove} aria-label="Remove photo" style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(20,20,30,0.7)', color: '#fff', fontSize: 11, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>
    </div>
  )
}

/* ── Products editor (the only thing the seller really has to provide) ─────── */
function ProductsPanel({ products, setProducts, digital }: { products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; digital: boolean }) {
  const [note, setNote] = useState('')
  const update = (id: string, fn: (p: Product) => Product) => setProducts(ps => ps.map(p => (p.id === id ? fn(p) : p)))

  const addFiles = (id: string, list: FileList | File[]) => {
    const all = [...list]
    const msgs: string[] = []
    update(id, p => {
      const imgs = [...p.images, ...all.filter(isImage)]
      if (imgs.length > MAX_PHOTOS) msgs.push(`Etsy allows ${MAX_PHOTOS} photos per listing, extra photos were skipped.`)
      let files = p.files
      if (digital) {
        const docs = all.filter(f => !isImage(f))
        const big = docs.filter(f => f.size > MAX_FILE_BYTES)
        if (big.length) msgs.push(`${big.map(f => f.name).join(', ')}: Etsy's limit is 20 MB per file.`)
        files = [...p.files, ...docs.filter(f => f.size <= MAX_FILE_BYTES)]
        if (files.length > MAX_FILES) msgs.push(`Etsy allows ${MAX_FILES} files per digital listing, extras were skipped.`)
      }
      return { ...p, images: imgs.slice(0, MAX_PHOTOS), files: files.slice(0, MAX_FILES) }
    })
    setNote(msgs.join(' '))
  }

  const splitPerPhoto = (list: FileList | null) => {
    if (!list) return
    const imgs = [...list].filter(isImage)
    setProducts(ps => [...ps.filter(p => p.images.length || p.files.length || p.hint), ...imgs.map(f => newProduct([f]))].slice(0, MAX_PRODUCTS))
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={noteStyle}>
        One card per listing. Add up to {MAX_PHOTOS} photos{digital ? ` and up to ${MAX_FILES} download files (PDF, ZIP, PNG..., max 20 MB each)` : ''}. The first photo is the thumbnail.
        The AI looks at the photos to work out what the product is; an optional note helps it.
      </p>
      {products.map((p, i) => (
        <div key={p.id}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (e.dataTransfer.files?.length) addFiles(p.id, e.dataTransfer.files) }}
          style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: 12, background: '#fafbfc', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 13, color: INK }}>Product {i + 1}</strong>
            <span style={{ fontSize: 11.5, color: FAINT }}>{p.images.length}/{MAX_PHOTOS} photos{digital ? ` · ${p.files.length}/${MAX_FILES} files` : ''}</span>
            {products.length > 1 && <button type="button" onClick={() => setProducts(ps => ps.filter(x => x.id !== p.id))} style={{ marginLeft: 'auto', fontSize: 12, color: '#c0271e', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>}
          </div>
          <input value={p.hint} onChange={e => update(p.id, x => ({ ...x, hint: e.target.value.slice(0, 200) }))} placeholder="Optional note, e.g. wedding welcome sign template" style={inputStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {p.images.map((f, k) => (
              <Thumb key={`${f.name}-${k}`} file={f} badge={k === 0 ? 'Thumbnail' : undefined}
                onRemove={() => update(p.id, x => ({ ...x, images: x.images.filter((_, j) => j !== k) }))} />
            ))}
            {p.images.length < MAX_PHOTOS && (
              <label style={{ aspectRatio: '1', borderRadius: 8, border: `1.5px dashed ${ORANGE}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', cursor: 'pointer', color: ORANGE, fontSize: 11, fontWeight: 600, background: '#fff', textAlign: 'center' }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>Photos
                <input type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) addFiles(p.id, e.target.files); e.target.value = '' }} />
              </label>
            )}
          </div>
          {digital && (
            <div style={{ display: 'grid', gap: 6 }}>
              {p.files.map((f, k) => (
                <div key={`${f.name}-${k}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 9px' }}>
                  <span style={{ fontWeight: 700, fontSize: 10, color: '#fff', background: '#64748b', borderRadius: 4, padding: '2px 5px' }}>{(f.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 4)}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: INK }}>{f.name}</span>
                  <span style={{ color: FAINT }}>{fmtBytes(f.size)}</span>
                  <button type="button" onClick={() => update(p.id, x => ({ ...x, files: x.files.filter((_, j) => j !== k) }))} style={{ border: 'none', background: 'none', color: '#c0271e', cursor: 'pointer', fontSize: 14 }} aria-label="Remove file">×</button>
                </div>
              ))}
              {p.files.length < MAX_FILES && (
                <label style={{ display: 'block', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: '#475569', border: '1.5px dashed #94a3b8', borderRadius: 8, padding: '8px', cursor: 'pointer', background: '#fff' }}>
                  + Digital files (PDF, ZIP...)
                  <input type="file" multiple hidden onChange={e => { if (e.target.files) addFiles(p.id, [...e.target.files].map(f => (isImage(f) ? new File([f], f.name, { type: 'application/octet-stream' }) : f))); e.target.value = '' }} />
                </label>
              )}
            </div>
          )}
        </div>
      ))}
      {note && <p style={{ ...noteStyle, color: '#b45309' }}>{note}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={products.length >= MAX_PRODUCTS} onClick={() => setProducts(ps => [...ps, newProduct()])} style={{ flex: 1, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, padding: '9px', fontSize: 13, fontWeight: 600, color: INK, cursor: 'pointer' }}>+ Add product</button>
        <label style={{ flex: 1, textAlign: 'center', background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, padding: '9px', fontSize: 13, fontWeight: 600, color: INK, cursor: 'pointer' }} title="Pick many photos at once: each photo becomes its own product">
          One product per photo
          <input type="file" accept="image/*" multiple hidden onChange={e => { splitPerPhoto(e.target.files); e.target.value = '' }} />
        </label>
      </div>
      <p style={noteStyle}>Max {MAX_PRODUCTS} products per run. Drag files onto a card to add them.</p>
    </div>
  )
}

/* ── Full listing preview for one result row ─────────────────────────────────── */
function ItemDetail({ it, media }: { it: RunItem; media?: MediaState }) {
  const [showDesc, setShowDesc] = useState(false)
  const row = (k: string, v: React.ReactNode) => v ? <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 8, fontSize: 12, lineHeight: 1.5 }}><span style={{ color: FAINT }}>{k}</span><span style={{ color: INK, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span></div> : null
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${LINE}` }}>
      {row('Title', it.title && <>{it.title} <span style={{ color: FAINT }}>({it.title.length}/140)</span></>)}
      {row('Category', it.taxonomyPath)}
      {row('Price', it.price != null && `${it.currency && it.currency !== 'USD' ? it.currency + ' ' : '$'}${it.price.toFixed(2)}`)}
      {row('SKU', it.sku)}
      {it.tags.length > 0 && row(`Tags (${it.tags.length})`, <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{it.tags.map(t => <span key={t} style={{ background: '#fdf2f8', color: '#be185d', borderRadius: 5, padding: '1px 6px', fontSize: 11 }}>{t}</span>)}</span>)}
      {row('Materials', it.materials.join(', '))}
      {row('Styles', it.styles.join(', '))}
      {it.attributes.length > 0 && row('Attributes', <span style={{ display: 'grid', gap: 2 }}>{it.attributes.map(a => <span key={a.propertyId}><span style={{ color: MUTED }}>{a.name}:</span> {a.values.join(', ')}</span>)}</span>)}
      {row('Alt text', it.altText)}
      {(it.imageCount > 0 || it.fileCount > 0) && it.listingId && row('Uploads', <>
        {it.imageCount > 0 && <span>{media?.img ?? it.imagesUploaded}/{it.imageCount} photos </span>}
        {it.fileCount > 0 && <span>· {media?.file ?? it.filesUploaded}/{it.fileCount} files</span>}
        {media?.busy && <span style={{ color: ORANGE }}> · uploading…</span>}
      </>)}
      {it.description && (
        <div>
          <button type="button" onClick={() => setShowDesc(s => !s)} style={{ background: 'none', border: 'none', padding: 0, color: ORANGE, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{showDesc ? 'Hide description' : 'Show description'}</button>
          {showDesc && <p style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#3a4051', lineHeight: 1.55, marginTop: 6, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, padding: 9 }}>{it.description}</p>}
        </div>
      )}
      {[...it.warnings, ...(media?.errors ?? [])].map((w, k) => <p key={k} style={{ fontSize: 11.5, color: '#b45309', margin: 0 }}>⚠ {w}</p>)}
    </div>
  )
}

function Editor() {
  const rf = useReactFlow()
  const storeApi = useStoreApi()
  const initial = useMemo(() => fullWorkflow(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<WFData>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges)
  const [selectedId, setSelectedId] = useState<string | null>('products')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>(() => [newProduct()])
  const [run, setRun] = useState<Run | null>(null)
  const [media, setMedia] = useState<Record<number, MediaState>>({})
  const [openItem, setOpenItem] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState('')
  const [execRunId, setExecRunId] = useState<string | null>(null)
  const stopRef = useRef(false)
  // What Execute captured, so Retry can re-send the same product's photos/files.
  const execRef = useRef<{ runId: string; sent: Product[]; uploadPhotos: boolean; uploadFiles: boolean; digital: boolean; publish: boolean } | null>(null)

  const cfgOf = useCallback((k: NodeKind): Cfg | undefined => nodes.find(n => n.data.kind === k)?.data.config, [nodes])
  const has = useCallback((k: NodeKind) => nodes.some(n => n.data.kind === k), [nodes])
  const shopId = String(cfgOf('shop')?.shopId ?? '')
  const digital = (cfgOf('details')?.type ?? 'physical') === 'download'
  const categoryCfg = cfgOf('category')
  const fixedTaxonomyId = categoryCfg?.mode === 'fixed' && categoryCfg?.taxonomyId ? Number(categoryCfg.taxonomyId) : null

  const { data: shops } = useQuery({ queryKey: ['etsy-shops'], queryFn: async () => (await axios.get('/api/etsy/shops')).data.data as Shop[], staleTime: 60_000 })
  const { data: taxonomy } = useQuery({ queryKey: ['etsy-taxonomy'], queryFn: async () => (await axios.get('/api/etsy/taxonomy')).data.data as Taxonomy[], staleTime: 3_600_000, enabled: has('category') })
  const { data: taxProps, isFetching: taxPropsLoading } = useQuery({
    queryKey: ['automation-tax-props', fixedTaxonomyId],
    queryFn: async () => (await axios.get(`/api/automation/taxonomy-properties?taxonomyId=${fixedTaxonomyId}`)).data.data as TaxProp[],
    enabled: !!fixedTaxonomyId && has('attributes'), staleTime: 3_600_000,
  })
  const { data: shopOpts, isFetching: shopOptsLoading, error: shopOptsError } = useQuery({
    queryKey: ['automation-shop-options', shopId],
    queryFn: async () => (await axios.get(`/api/automation/shop-options?shopId=${encodeURIComponent(shopId)}`)).data.data as ShopOptions,
    enabled: !!shopId && has('delivery'), staleTime: 300_000, retry: false,
  })

  // Safety net for node measurement. v11 measures each node via a ResizeObserver,
  // which is reliable in a normal visible tab (unlike v12 in this stack). This only
  // nudges v11's OWN measurement (updateNodeDimensions) for nodes that don't yet have
  // dimensions, a no-op the instant the observer has measured them. It exists purely
  // to cover a paused/throttled observer (e.g. a backgrounded tab). Re-runs on node
  // count changes and retries a few times to catch rapid adds and late paints.
  useEffect(() => {
    const api = storeApi
    let timer: ReturnType<typeof setTimeout> | null = null
    let tries = 0
    const tick = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = api.getState() as any
      const internals = st.nodeInternals as Map<string, { width?: number }>
      const updates: { id: string; nodeElement: HTMLElement; forceUpdate: boolean }[] = []
      document.querySelectorAll<HTMLElement>('.react-flow__node').forEach(el => {
        const id = el.getAttribute('data-id')
        if (!id || internals.get(id)?.width) return // already measured → skip
        if (el.offsetWidth) updates.push({ id, nodeElement: el, forceUpdate: true })
      })
      if (updates.length) st.updateNodeDimensions(updates)
      if (++tries < 8) timer = setTimeout(tick, 100)
    }
    timer = setTimeout(tick, 30)
    return () => { if (timer) clearTimeout(timer) }
  }, [nodes.length, storeApi])

  const onConnect = useCallback((c: Connection) => setEdges(eds => addEdge({ ...c, animated: true, style: { ...EDGE_STYLE } }, eds)), [setEdges])

  // Proximity connect: drag a node near another and they link automatically (a
  // dashed preview appears while dragging, committed on drop). Left node → right
  // node by x-position. Measurement-INDEPENDENT: uses each node's plain position.
  const MIN_DIST = 150
  const closestEdge = useCallback((node: Node) => {
    const dp = node.position
    if (!dp) return null
    let closest: { id: string; x: number } | null = null
    let min = MIN_DIST
    for (const n of rf.getNodes()) {
      if (n.id === node.id) continue
      const p = n.position
      if (!p) continue
      const d = Math.hypot(p.x - dp.x, p.y - dp.y)
      if (d < min) { min = d; closest = { id: n.id, x: p.x } }
    }
    if (!closest) return null
    const closeIsSource = closest.x < dp.x
    const source = closeIsSource ? closest.id : node.id
    const target = closeIsSource ? node.id : closest.id
    return { id: `e-${source}-${target}`, source, target }
  }, [rf])

  const onNodeDrag = useCallback((_: unknown, node: Node) => {
    const ce = closestEdge(node)
    setEdges(es => {
      const base = es.filter(e => e.className !== 'rk-temp')
      if (ce && !base.some(e => (e.source === ce.source && e.target === ce.target) || (e.source === ce.target && e.target === ce.source))) {
        base.push({ ...ce, className: 'rk-temp', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2.5, strokeDasharray: '6 5' } })
      }
      return base
    })
  }, [closestEdge, setEdges])

  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    const ce = closestEdge(node)
    setEdges(es => {
      const base = es.filter(e => e.className !== 'rk-temp')
      if (ce && !base.some(e => (e.source === ce.source && e.target === ce.target) || (e.source === ce.target && e.target === ce.source))) {
        base.push({ ...ce, animated: true, style: { ...EDGE_STYLE } })
      }
      return base
    })
  }, [closestEdge, setEdges])

  const addNode = useCallback((kind: NodeKind) => {
    setPaletteOpen(false); setErr('')
    const existing = nodes.find(n => n.data.kind === kind)
    if (existing) { setSelectedId(existing.id); return }   // one of each section: just open it
    const id = newId()
    // Chain from the selected node (or the right-most node) so the flow reads left→right.
    const from = nodes.find(n => n.id === selectedId) ?? nodes.reduce<WFNode | null>((r, n) => (!r || n.position.x > r.position.x ? n : r), null)
    const pos = from ? { x: from.position.x + 190, y: from.position.y } : { x: 120, y: 200 }
    setNodes(ns => ns.concat({ id, type: 'wf', position: pos, data: { kind, status: 'idle', config: structuredClone(DEFAULTS[kind]) } }))
    if (from && from.id !== id) {
      setEdges(es => addEdge({ id: `e-${from.id}-${id}`, source: from.id, target: id, animated: true, style: { ...EDGE_STYLE } }, es))
    }
    setSelectedId(id)
    setTimeout(() => rf.fitView({ duration: 300, padding: 0.2 }), 60)
  }, [nodes, selectedId, rf, setNodes, setEdges])

  const resetWorkflow = useCallback(() => {
    const w = fullWorkflow()
    setNodes(w.nodes); setEdges(w.edges); setSelectedId('products'); setErr('')
    setTimeout(() => rf.fitView({ duration: 300, padding: 0.15 }), 60)
  }, [rf, setNodes, setEdges])

  const selected = nodes.find(n => n.id === selectedId) ?? null
  const setConfig = useCallback((patch: Cfg) => {
    if (!selectedId) return
    setNodes(ns => ns.map(n => n.id === selectedId ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n))
  }, [selectedId, setNodes])

  const setAllStatus = useCallback((fn: (k: NodeKind) => NodeStatus) => {
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, status: fn(n.data.kind) } })))
  }, [setNodes])

  /* Per-node one-line summary + "needs a setting" flag, shown under each node. */
  const publishing = has('draft')
  const decorated = useMemo(() => {
    const geo = String(nodes.find(x => x.data.kind === 'products')?.data.config.geo || 'US')
    return nodes.map(n => {
    const c = n.data.config
    let summary = ''
    let warn = false
    switch (n.data.kind) {
      case 'products': {
        if (c.mode === 'products') {
          const ready = products.filter(p => p.images.length || p.hint.trim()).length
          summary = ready ? `${ready} product${ready > 1 ? 's' : ''}` : 'Add photos'
          warn = !ready
        } else summary = c.mode === 'niche' ? (String(c.niche || '') || 'Set a niche') : 'Keywords'
        break
      }
      case 'research': summary = `Market: ${geo}`; break
      case 'category': summary = c.mode === 'fixed' ? (String(c.taxonomyPath || '').split(' › ').pop() || 'Pick one') : 'Auto from market'; warn = c.mode === 'fixed' && !c.taxonomyId; break
      case 'title': summary = c.style === 'benefit-first' ? 'Benefit first' : 'Keyword first'; break
      case 'description': summary = `${String(c.length)} · ${String(c.tone)}`; break
      case 'tags': summary = '13 tags' + (c.materials ? ' + materials' : ''); break
      case 'attributes': summary = c.mode === 'off' ? 'Off' : `AI fills${Object.keys((c.fixed as Cfg) ?? {}).length ? ` · ${Object.keys(c.fixed as Cfg).length} pinned` : ''}`; break
      case 'price': summary = c.strategy === 'fixed' ? (c.fixed ? `$${c.fixed}` : 'Set price') : String(c.strategy); warn = c.strategy === 'fixed' && !Number(c.fixed); if (c.sku) summary += ' · SKU'; break
      case 'details': summary = c.type === 'download' ? 'Digital' : 'Physical'; break
      case 'delivery': summary = digital ? 'Instant download' : (c.shippingProfileId ? 'Shipping set' : 'Pick shipping'); warn = publishing && !digital && !c.shippingProfileId; break
      case 'shop': summary = shops?.find(s => s.shopId === c.shopId)?.shopName ?? 'Pick a shop'; warn = publishing && !c.shopId; break
      case 'draft': summary = 'Drafts only'; break
    }
    return { ...n, data: { ...n.data, summary, warn } }
    })
  }, [nodes, products, digital, publishing, shops])

  /* ── Execute ────────────────────────────────────────────────────────────── */
  const buildConfig = useCallback(() => {
    const c = (k: NodeKind) => cfgOf(k) ?? DEFAULTS[k]
    const draft = cfgOf('draft')
    return {
      category: c('category'), title: c('title'), description: c('description'), tags: c('tags'),
      attributes: c('attributes'), price: c('price'), details: c('details'), delivery: c('delivery'),
      publish: { enabled: !!draft, shopId: shopId || null, uploadPhotos: draft?.uploadPhotos !== false, uploadFiles: draft?.uploadFiles !== false },
    }
  }, [cfgOf, shopId])

  const pushMedia = useCallback(async (ctx: NonNullable<typeof execRef.current>, it: RunItem) => {
    const prod = ctx.sent[it.idx]
    if (!prod || !it.listingId) return
    const photos = ctx.uploadPhotos ? prod.images : []
    const files = ctx.digital && ctx.uploadFiles ? prod.files : []
    if (!photos.length && !files.length) return
    const st: MediaState = { img: 0, imgTotal: photos.length, file: 0, fileTotal: files.length, busy: true, errors: [] }
    const commit = () => setMedia(m => ({ ...m, [it.idx]: { ...st, errors: [...st.errors] } }))
    commit()
    // Sequential: Etsy orders photos by upload rank and rate-limits bursts.
    for (let k = 0; k < photos.length; k++) {
      try { await uploadMedia(ctx.runId, it.idx, 'image', await uploadable(photos[k]), k + 1); st.img++ }
      catch (e) { st.errors.push(e instanceof Error ? e.message : 'Photo upload failed.') }
      commit()
    }
    for (let k = 0; k < files.length; k++) {
      try { await uploadMedia(ctx.runId, it.idx, 'file', files[k], k + 1); st.file++ }
      catch (e) { st.errors.push(e instanceof Error ? e.message : 'File upload failed.') }
      commit()
    }
    st.busy = false
    commit()
  }, [])

  const stepOnce = useCallback(async (ctx: NonNullable<typeof execRef.current>, idx: number, retry = false) => {
    const prod = ctx.sent[idx]
    const images = prod ? await Promise.all(prod.images.slice(0, 4).map(previewOf)).catch(() => []) : []
    const body = { ...(retry ? { retryIdx: idx } : { idx }), images, fileNames: prod?.files.map(f => f.name) ?? [] }
    return axios.post(`/api/automation/runs/${ctx.runId}/step`, body).then(r => r.data).catch(e => (axios.isAxiosError(e) ? e.response?.data : null) ?? null)
  }, [])

  const execute = useCallback(async () => {
    setErr(''); setRun(null); setMedia({}); setOpenItem(null)
    const source = nodes.find(n => n.data.kind === 'products')
    if (!source) { setErr('Add a Products node.'); return }
    const sc = source.data.config
    const cfg = buildConfig()
    const mode = String(sc.mode)
    const sent = mode === 'products' ? products.filter(p => p.images.length || p.hint.trim()) : []
    if (mode === 'products' && !sent.length) { setErr('Add at least one product with photos on the Products node.'); setSelectedId('products'); return }
    if (cfg.category.mode === 'fixed' && !cfg.category.taxonomyId) { setErr('Pick a category on the Category node (or switch it to Auto).'); return }
    if (cfg.price.strategy === 'fixed' && !Number(cfg.price.fixed)) { setErr('Enter the fixed price on the Price & Inventory node.'); return }
    if (cfg.publish.enabled) {
      if (!cfg.publish.shopId) { setErr('Create Draft needs a shop: pick one on the Shop node (add a Shop node if missing).'); return }
      if (!digital && !cfgOf('delivery')?.shippingProfileId) { setErr('Physical listings need a shipping profile: pick one on the Delivery node (or set How It\'s Made to Digital).'); return }
      if (!digital && shopOpts?.processingProfiles.length && !cfgOf('delivery')?.readinessStateId) { setErr('Pick a processing profile on the Delivery node (Etsy requires it for physical listings).'); return }
      if (digital && cfg.publish.uploadFiles && mode === 'products' && sent.some(p => !p.files.length)) { setErr('Every digital product needs its download file. Add files on the Products node, or untick "Upload digital files" on Create Draft.'); return }
    }

    setRunning(true)
    stopRef.current = false
    setAllStatus(k => (k === 'products' ? 'running' : 'idle'))
    try {
      const seeds = String(sc.seeds ?? '').split('\n').map(s => s.trim()).filter(Boolean)
      const { data } = await axios.post('/api/automation/runs', {
        mode,
        niche: mode === 'niche' ? sc.niche : undefined,
        seeds: mode === 'keywords' ? seeds : undefined,
        products: mode === 'products' ? sent.map(p => ({ hint: p.hint, imageCount: p.images.length, fileCount: digital ? p.files.length : 0 })) : undefined,
        count: Number(sc.count) || 5,
        geo: sc.geo || 'US',
        config: cfg,
      })
      if (!data.success) throw new Error(data.error || 'Could not start.')
      const ctx = { runId: data.data.id as string, sent, uploadPhotos: cfg.publish.uploadPhotos, uploadFiles: cfg.publish.uploadFiles, digital, publish: cfg.publish.enabled }
      execRef.current = ctx
      setExecRunId(ctx.runId)
      setAllStatus(k => (k === 'products' ? 'done' : 'running'))

      let current: Run = (await axios.get(`/api/automation/runs/${ctx.runId}`)).data.data
      setRun(current)
      while (!stopRef.current) {
        const next = current.items.find(i => i.status === 'pending')
        if (!next) break
        const step = await stepOnce(ctx, next.idx)
        if (!step?.success) { setErr(step?.error || 'A step failed.'); break }
        current = step.data as Run
        setRun(current)
        const it = current.items.find(i => i.idx === current.lastIdx)
        if (it?.listingId && ctx.publish) await pushMedia(ctx, it)
      }
      setAllStatus(() => 'done')
    } catch (e) {
      setErr(axios.isAxiosError(e) ? (e.response?.data?.error as string) || 'Request failed.' : (e instanceof Error ? e.message : 'Request failed.'))
      setAllStatus(() => 'error')
    } finally {
      setRunning(false)
    }
  }, [nodes, products, digital, buildConfig, cfgOf, shopOpts, setAllStatus, stepOnce, pushMedia])

  const retryItem = useCallback(async (idx: number) => {
    const ctx = execRef.current
    if (!ctx || running) return
    setRunning(true); setErr('')
    try {
      const step = await stepOnce(ctx, idx, true)
      if (!step?.success) { setErr(step?.error || 'Retry failed.'); return }
      const current = step.data as Run
      setRun(current)
      const it = current.items.find(i => i.idx === idx)
      if (it?.listingId && ctx.publish) await pushMedia(ctx, it)
    } finally {
      setRunning(false)
    }
  }, [running, stepOnce, pushMedia])

  const taxMatches = useMemo(() => {
    const q = String(categoryCfg?.taxQuery ?? '').trim().toLowerCase()
    return (taxonomy ?? []).filter(t => !q || t.fullPath.toLowerCase().includes(q)).slice(0, 80)
  }, [taxonomy, categoryCfg])

  const sel = selected?.data.config ?? {}
  const kind = selected?.data.kind
  const wideDrawer = kind === 'products' && sel.mode === 'products'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f4f5f8', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #e6e8ee', background: '#fff', zIndex: 5, flexWrap: 'wrap' }}>
        <Link href="/dashboard?tab=automate" style={{ fontSize: 13, color: MUTED, textDecoration: 'none' }}>← Dashboard</Link>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: ORANGE, background: `${ORANGE}18`, padding: '4px 10px', borderRadius: 100 }}>Admin only</span>
        <strong style={{ fontSize: 16, color: INK }}>Automate Listing</strong>
        <span style={{ fontSize: 13, color: FAINT }}>Photos in, complete Etsy drafts out</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button onClick={resetWorkflow} disabled={running} style={{ background: '#fff', border: '1px solid #d7dbe4', borderRadius: 9, padding: '8px 14px', fontSize: 13.5, fontWeight: 600, color: INK, cursor: 'pointer' }}>Reset workflow</button>
          <button onClick={() => setPaletteOpen(o => !o)} style={{ background: '#fff', border: '1px solid #d7dbe4', borderRadius: 9, padding: '8px 14px', fontSize: 13.5, fontWeight: 600, color: INK, cursor: 'pointer' }}>+ Add node</button>
          {running
            ? <button onClick={() => { stopRef.current = true }} style={{ background: INK, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Stop after this product</button>
            : <button onClick={execute} style={{ background: ORANGE, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Execute
              </button>}
        </div>
      </div>

      {err && <div style={{ background: '#fff0f0', color: '#c0271e', fontSize: 13, padding: '9px 18px', borderBottom: '1px solid #f3d6d2' }}>{err}</div>}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={decorated}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_, n) => { setSelectedId(n.id); setPaletteOpen(false) }}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            selectNodesOnDrag={false}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={48}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#d3d7e0" />
            <Controls showInteractive={false} />
          </ReactFlow>

          {/* Palette popover */}
          {paletteOpen && (
            <div style={{ position: 'absolute', top: 12, right: 12, width: 300, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 20px 50px rgba(30,30,50,0.16)', overflow: 'hidden', zIndex: 20 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #eef0f4', fontSize: 12.5, fontWeight: 600, color: MUTED }}>Add a node</div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {ORDER.map(k => (
                  <button key={k} onClick={() => addNode(k)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f4f5f8', cursor: 'pointer', textAlign: 'left', opacity: has(k) ? 0.5 : 1 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: `${DEFS[k].color}18`, color: DEFS[k].color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{DEFS[k].icon}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: INK }}>{DEFS[k].label}{DEFS[k].role ? ` · ${DEFS[k].role}` : ''}{has(k) ? ' (added)' : ''}</span>
                      <span style={{ display: 'block', fontSize: 12, color: FAINT }}>{DEFS[k].hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom node toolbar: quick-add (each button drops a node, auto-connected) */}
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '8px 10px', boxShadow: '0 14px 36px rgba(30,30,50,0.14)', zIndex: 15 }}>
            {ORDER.map(k => (
              <button key={k} title={`${has(k) ? 'Select' : 'Add'} ${DEFS[k].label}`} onClick={() => addNode(k)}
                style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${DEFS[k].color}40`, background: has(k) ? `${DEFS[k].color}10` : '#fff', color: DEFS[k].color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ display: 'flex', transform: 'scale(0.8)' }}>{DEFS[k].icon}</span>
              </button>
            ))}
          </div>

          {/* Results panel */}
          {run && (
            <div style={{ position: 'absolute', left: 18, top: 18, bottom: 80, width: 400, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 20px 50px rgba(30,30,50,0.16)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #eef0f4' }}>
                <strong style={{ fontSize: 14, color: INK }}>Run · {run.done}/{run.total}{run.errored ? ` · ${run.errored} failed` : ''}{running ? ' · working…' : ''}</strong>
                <button onClick={() => setRun(null)} disabled={running} style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {run.items.map(it => {
                  const m = media[it.idx]
                  const open = openItem === it.idx
                  return (
                    <div key={it.idx} style={{ padding: '9px 11px', background: '#f7f8fb', borderRadius: 9 }}>
                      <div style={{ display: 'flex', gap: 9, cursor: it.title ? 'pointer' : 'default' }} onClick={() => it.title && setOpenItem(open ? null : it.idx)}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: it.status === 'done' ? '#22C55E' : it.status === 'error' ? '#DC2626' : it.status === 'running' ? ORANGE : '#b9bfca' }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{it.keyword}</span>
                            {it.price != null && <span style={{ fontSize: 11.5, color: '#16a34a' }}>{it.currency && it.currency !== 'USD' ? `${it.currency} ` : '$'}{it.price.toFixed(2)}</span>}
                            {it.listingUrl && <a href={it.listingUrl} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: ORANGE, fontWeight: 600 }}>Open draft →</a>}
                            {m?.busy && <span style={{ fontSize: 11, color: ORANGE }}>uploading {m.img + m.file}/{m.imgTotal + m.fileTotal}</span>}
                            {(it.warnings.length > 0 || (m?.errors.length ?? 0) > 0) && <span style={{ fontSize: 11, color: '#b45309' }}>⚠ {it.warnings.length + (m?.errors.length ?? 0)}</span>}
                          </div>
                          {it.title && <p style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>{it.title}</p>}
                          {it.error && <p style={{ fontSize: 11.5, color: '#DC2626', marginTop: 2 }}>{it.error}</p>}
                          {it.status === 'error' && !it.listingId && !running && execRunId === run.id && (
                            <button onClick={e => { e.stopPropagation(); retryItem(it.idx) }} style={{ marginTop: 5, fontSize: 11.5, fontWeight: 600, color: ORANGE, background: '#fff', border: `1px solid ${ORANGE}55`, borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}>Retry</button>
                          )}
                        </div>
                      </div>
                      {open && <ItemDetail it={it} media={m} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Config drawer */}
        {selected && kind && (
          <aside style={{ width: wideDrawer ? 420 : 340, background: '#fff', borderLeft: '1px solid #e6e8ee', padding: 18, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: `${DEFS[kind].color}18`, color: DEFS[kind].color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{DEFS[kind].icon}</span>
              <strong style={{ fontSize: 15, color: INK }}>{DEFS[kind].label}</strong>
              {kind !== 'products' && (
                <button onClick={() => { setNodes(ns => ns.filter(n => n.id !== selected.id)); setEdges(es => es.filter(e => e.source !== selected.id && e.target !== selected.id)); setSelectedId(null) }}
                  style={{ marginLeft: 'auto', fontSize: 12, color: '#c0271e', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              )}
            </div>
            <p style={{ ...noteStyle, marginBottom: 16 }}>{DEFS[kind].hint}</p>

            <div style={{ display: 'grid', gap: 14 }}>
              {kind === 'products' && (<>
                <Segmented value={sel.mode} onChange={v => setConfig({ mode: v })} options={[['products', 'My products'], ['niche', 'Niche (AI)'], ['keywords', 'Keywords']]} />
                {sel.mode === 'products' && <ProductsPanel products={products} setProducts={setProducts} digital={digital} />}
                {sel.mode === 'niche' && <Field label="Niche"><Text value={sel.niche} onChange={v => setConfig({ niche: v })} placeholder="minimalist nursery wall art" /></Field>}
                {sel.mode === 'keywords' && <Field label="Keywords (one per line)"><textarea value={String(sel.seeds ?? '')} onChange={e => setConfig({ seeds: e.target.value })} rows={6} style={{ ...inputStyle, resize: 'vertical' }} placeholder={'ceramic coffee mug\npersonalized dog bandana'} /></Field>}
                <div style={{ display: 'grid', gridTemplateColumns: sel.mode === 'products' ? '1fr' : '1fr 1fr', gap: 10 }}>
                  {sel.mode !== 'products' && <Field label="Products"><Text value={sel.count} onChange={v => setConfig({ count: v })} numeric /></Field>}
                  <Field label="Market"><Text value={sel.geo} onChange={v => setConfig({ geo: v.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) })} /></Field>
                </div>
                {sel.mode !== 'products' && <p style={noteStyle}>Text-only modes create listings without photos; add photos to the drafts on Etsy before publishing.</p>}
              </>)}

              {kind === 'research' && (
                <p style={noteStyle}>For every product this pulls the real Google search volume, the tags the top 50 live Etsy listings use, which categories they sit in and what they charge. Every other step is grounded in that data, nothing is invented.</p>
              )}

              {kind === 'category' && (<>
                <Segmented value={sel.mode} onChange={v => setConfig({ mode: v })} options={[['auto', 'Auto (from market)'], ['fixed', 'Same for all']]} />
                {sel.mode === 'auto'
                  ? <p style={noteStyle}>Each product goes in the category most of the top-ranking listings for its keyword use. Shown on every result.</p>
                  : <Field label="Category" note={sel.taxonomyPath ? `Selected: ${String(sel.taxonomyPath)}` : undefined}>
                      <input value={String(sel.taxQuery ?? '')} onChange={e => setConfig({ taxQuery: e.target.value })} placeholder="Search categories…" style={{ ...inputStyle, marginBottom: 8 }} />
                      <select value={String(sel.taxonomyId ?? '')} onChange={e => { const t = taxonomy?.find(x => String(x.id) === e.target.value); setConfig({ taxonomyId: e.target.value, taxonomyPath: t?.fullPath ?? '' }) }} style={inputStyle} size={8}>
                        {taxMatches.map(t => <option key={t.id} value={t.id}>{t.fullPath}</option>)}
                      </select>
                    </Field>}
              </>)}

              {kind === 'title' && (<>
                <Field label="Title style"><Select value={sel.style} onChange={v => setConfig({ style: v })} options={[['keyword-first', 'Keyword first (max SEO)'], ['benefit-first', 'Benefit first (more clickable)']]} /></Field>
                <Field label="Max length" note="Etsy allows 140 characters. Shorter titles read better on mobile."><Select value={sel.maxLength} onChange={v => setConfig({ maxLength: Number(v) })} options={[['140', '140 (full)'], ['110', '110'], ['80', '80 (short)']]} /></Field>
                <Field label="Always include (optional)"><Text value={sel.mustInclude} onChange={v => setConfig({ mustInclude: v.slice(0, 60) })} placeholder="e.g. Instant Download" /></Field>
              </>)}

              {kind === 'description' && (<>
                <Field label="Length"><Select value={sel.length} onChange={v => setConfig({ length: v })} options={[['concise', 'Concise (~80 words)'], ['standard', 'Standard (~150 words)'], ['detailed', 'Detailed (~250 words)']]} /></Field>
                <Field label="Tone"><Select value={sel.tone} onChange={v => setConfig({ tone: v })} options={[['friendly', 'Friendly'], ['professional', 'Professional'], ['luxury', 'Luxury'], ['playful', 'Playful']]} /></Field>
                <Field label="Footer added to every listing (optional)" note="Shop policies, care instructions, how downloads work...">
                  <textarea value={String(sel.footer ?? '')} onChange={e => setConfig({ footer: e.target.value.slice(0, 2000) })} rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                </Field>
              </>)}

              {kind === 'tags' && (<>
                <Field label="Tag focus"><Select value={sel.focus} onChange={v => setConfig({ focus: v })} options={[['long-tail', 'Long-tail (specific, lower competition)'], ['broad', 'Broad (high volume)'], ['mixed', 'Mixed']]} /></Field>
                <Field label="Always use these tags (comma separated)" note="Counted inside the 13. Max 20 characters each."><Text value={sel.always} onChange={v => setConfig({ always: v })} placeholder="gift for her, digital planner" /></Field>
                <Toggle checked={sel.materials !== false} onChange={v => setConfig({ materials: v })} label="Fill Materials" note="What it's made of, from the photos (up to 13)." />
                <Toggle checked={sel.styles !== false} onChange={v => setConfig({ styles: v })} label="Fill Styles" note="Up to 2 style words, e.g. Boho, Minimalist." />
              </>)}

              {kind === 'attributes' && (<>
                <Segmented value={sel.mode} onChange={v => setConfig({ mode: v })} options={[['auto', 'AI fills them'], ['off', 'Off']]} />
                {sel.mode !== 'off' && (fixedTaxonomyId
                  ? (taxPropsLoading ? <p style={noteStyle}>Loading this category&apos;s attributes…</p>
                    : (taxProps?.length
                      ? <>
                          <p style={noteStyle}>Leave on Auto and the AI picks per product, or pin a value for every listing.</p>
                          {taxProps.map(p => {
                            const fixed = (sel.fixed as Record<string, number[]>) ?? {}
                            return (
                              <Field key={p.propertyId} label={`${p.name}${p.required ? ' *' : ''}`}>
                                <select value={String(fixed[String(p.propertyId)]?.[0] ?? '')} onChange={e => {
                                  const next = { ...fixed }
                                  if (e.target.value) next[String(p.propertyId)] = [Number(e.target.value)]
                                  else delete next[String(p.propertyId)]
                                  setConfig({ fixed: next })
                                }} style={inputStyle}>
                                  <option value="">Auto (AI decides)</option>
                                  {p.values.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                              </Field>
                            )
                          })}
                        </>
                      : <p style={noteStyle}>This category has no selectable attributes.</p>))
                  : <p style={noteStyle}>The Category node is on Auto, so each product&apos;s attributes (Craft type, Occasion, Celebration, Holiday, colors and whatever else its category offers) are chosen by the AI from Etsy&apos;s allowed values. Set a fixed category to pin specific values.</p>)}
              </>)}

              {kind === 'price' && (<>
                <Field label="Pricing"><Select value={sel.strategy} onChange={v => setConfig({ strategy: v })} options={[['median', 'Match market median'], ['undercut', 'Undercut ~10%'], ['premium', 'Premium ~15%'], ['fixed', 'Fixed price for all']]} /></Field>
                {sel.strategy === 'fixed'
                  ? <Field label="Price (shop currency)"><Text value={sel.fixed} onChange={v => setConfig({ fixed: v })} numeric placeholder="12.99" /></Field>
                  : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Field label="Min price"><Text value={sel.min} onChange={v => setConfig({ min: v })} numeric placeholder="none" /></Field>
                      <Field label="Max price"><Text value={sel.max} onChange={v => setConfig({ max: v })} numeric placeholder="none" /></Field>
                    </div>}
                {sel.strategy !== 'fixed' && <Toggle checked={sel.charm !== false} onChange={v => setConfig({ charm: v })} label="End prices in .99" />}
                <Field label="Quantity"><Text value={sel.quantity} onChange={v => setConfig({ quantity: v })} numeric /></Field>
                <Field label="SKU pattern (optional)" note={<>Tokens: {'{N}'} item number, {'{KW}'} keyword, {'{DATE}'}, {'{RAND}'}. Example: RK-{'{KW}'}-{'{N}'}</>}>
                  <Text value={sel.sku} onChange={v => setConfig({ sku: v.slice(0, 40) })} placeholder="RK-{KW}-{N}" />
                </Field>
              </>)}

              {kind === 'details' && (<>
                <Field label="Type"><Segmented value={sel.type} onChange={v => setConfig({ type: v })} options={[['physical', 'Physical item'], ['download', 'Digital download']]} /></Field>
                <Field label="Who made it?"><Select value={sel.whoMade} onChange={v => setConfig({ whoMade: v })} options={[['i_did', 'I did'], ['collective', 'A member of my shop'], ['someone_else', 'Another company or person']]} /></Field>
                <Field label="What is it?"><Select value={String(!!sel.isSupply)} onChange={v => setConfig({ isSupply: v === 'true' })} options={[['false', 'A finished product'], ['true', 'A supply or tool to make things']]} /></Field>
                <Field label="When was it made?"><Select value={sel.whenMade} onChange={v => setConfig({ whenMade: v })} options={[['made_to_order', 'Made to order'], ['recent', `2020 - ${new Date().getFullYear()}`]]} /></Field>
                <Field label="Personalization"><Select value={sel.personalization} onChange={v => setConfig({ personalization: v })} options={[['off', 'Off'], ['optional', 'Optional for buyers'], ['required', 'Required']]} /></Field>
                {sel.personalization !== 'off' && (<>
                  <Field label="Instructions for buyers" note="Leave empty and the AI writes it per product."><Text value={sel.personalizationInstructions} onChange={v => setConfig({ personalizationInstructions: v.slice(0, 256) })} placeholder="Enter the name and date to print" /></Field>
                  <Field label="Character limit"><Text value={sel.personalizationMax} onChange={v => setConfig({ personalizationMax: v })} numeric /></Field>
                </>)}
                <Toggle checked={sel.autoRenew !== false} onChange={v => setConfig({ autoRenew: v })} label="Auto-renew when it expires" />
                {sel.whoMade === 'someone_else' && <p style={{ ...noteStyle, color: '#b45309' }}>Etsy asks for a production partner when someone else makes the item. Add it on Etsy before publishing.</p>}
              </>)}

              {kind === 'delivery' && (digital
                ? <>
                    <p style={noteStyle}>Digital downloads are delivered instantly by Etsy, no shipping or processing needed. Attach the files on the Products node.</p>
                    {shopOpts && shopOpts.sections.length > 0 && <Field label="Shop section (optional)"><Select value={sel.shopSectionId} onChange={v => setConfig({ shopSectionId: v })} options={[['', 'None'], ...shopOpts.sections.map(s => [String(s.id), s.title] as [string, string])]} /></Field>}
                  </>
                : !shopId
                  ? <p style={noteStyle}>Pick a shop on the Shop node first: shipping profiles, processing times and return policies come from that shop.</p>
                  : shopOptsLoading ? <p style={noteStyle}>Loading the shop&apos;s delivery settings…</p>
                  : shopOptsError ? <p style={{ ...noteStyle, color: '#c0271e' }}>Could not load this shop&apos;s settings. Reconnect it in My Shop.</p>
                  : shopOpts && (<>
                    <Field label="Shipping profile *" note={!shopOpts.shippingProfiles.length ? 'This shop has no shipping profiles yet. Create one in Etsy (Settings → Delivery) first.' : undefined}>
                      <Select value={sel.shippingProfileId} onChange={v => setConfig({ shippingProfileId: v })} options={[['', 'Select a shipping profile'], ...shopOpts.shippingProfiles.map(p => [String(p.id), `${p.title}${p.origin ? ` (${p.origin})` : ''}`] as [string, string])]} />
                    </Field>
                    {shopOpts.processingProfiles.length > 0 && (
                      <Field label="Processing time *"><Select value={sel.readinessStateId} onChange={v => setConfig({ readinessStateId: v })} options={[['', 'Select a processing profile'], ...shopOpts.processingProfiles.map(p => [String(p.id), p.label] as [string, string])]} /></Field>
                    )}
                    <Field label="Return policy"><Select value={sel.returnPolicyId} onChange={v => setConfig({ returnPolicyId: v })} options={[['', 'Shop default'], ...shopOpts.returnPolicies.map(p => [String(p.id), p.label] as [string, string])]} /></Field>
                    {shopOpts.sections.length > 0 && <Field label="Shop section (optional)"><Select value={sel.shopSectionId} onChange={v => setConfig({ shopSectionId: v })} options={[['', 'None'], ...shopOpts.sections.map(s => [String(s.id), s.title] as [string, string])]} /></Field>}
                    <Field label="Item weight (optional)">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                        <Text value={sel.weight} onChange={v => setConfig({ weight: v })} numeric placeholder="e.g. 8" />
                        <Select value={sel.weightUnit} onChange={v => setConfig({ weightUnit: v })} options={[['oz', 'oz'], ['lb', 'lb'], ['g', 'g'], ['kg', 'kg']]} />
                      </div>
                    </Field>
                    <Field label="Package size L × W × H (optional)">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 70px', gap: 6 }}>
                        <Text value={sel.length} onChange={v => setConfig({ length: v })} numeric placeholder="L" />
                        <Text value={sel.width} onChange={v => setConfig({ width: v })} numeric placeholder="W" />
                        <Text value={sel.height} onChange={v => setConfig({ height: v })} numeric placeholder="H" />
                        <Select value={sel.dimUnit} onChange={v => setConfig({ dimUnit: v })} options={[['in', 'in'], ['cm', 'cm'], ['mm', 'mm']]} />
                      </div>
                    </Field>
                  </>))}

              {kind === 'shop' && (
                <Field label="Upload to shop" note="Connect shops in the dashboard → My Shop. Needed when a Create Draft node is present.">
                  <Select value={sel.shopId} onChange={v => setConfig({ shopId: v })} options={[['', shops?.length ? 'Select a shop' : 'No connected shops'], ...(shops ?? []).map(s => [s.shopId, s.shopName] as [string, string])]} />
                </Field>
              )}

              {kind === 'draft' && (<>
                <Toggle checked={sel.uploadPhotos !== false} onChange={v => setConfig({ uploadPhotos: v })} label="Upload the product photos" note="In order, first photo as thumbnail, with AI alt text." />
                {digital && <Toggle checked={sel.uploadFiles !== false} onChange={v => setConfig({ uploadFiles: v })} label="Upload digital files" note="The PDFs / files buyers download." />}
                <p style={noteStyle}>Listings are created as DRAFTS with their attributes and SKU set. Nothing goes live until you review and publish on Etsy. Remove this node to only generate the content.</p>
              </>)}
            </div>
          </aside>
        )}

        {!selected && (
          <aside style={{ width: 340, background: '#fff', borderLeft: '1px solid #e6e8ee', padding: 20, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>How it works</h3>
            <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>Every node is one section of Etsy&apos;s listing form. You only add the photos (and files for digital items); the rest is filled from real market data.</p>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
              {([
                ['Products', 'Add a card per product with its photos (max 20) and, for digital items, the PDF or files.'],
                ["How It's Made", 'Physical or digital, who made it, personalization.'],
                ['Shop + Delivery', 'Pick the shop, then its shipping profile, processing time and return policy.'],
                ['Tune the rest (optional)', 'Category, title, description, tags, attributes, price and SKU all work on Auto.'],
                ['Execute', 'Each product gets a full listing and lands in your shop as a draft with photos and files.'],
              ] as const).map(([t, d]) => (
                <li key={t} style={{ fontSize: 13, color: '#3a4051', lineHeight: 1.55 }}><strong style={{ color: INK }}>{t}.</strong> {d}</li>
              ))}
            </ol>
            <p style={{ fontSize: 12, color: FAINT, lineHeight: 1.55, marginTop: 16 }}>A red dot on a node means it still needs a setting.</p>
          </aside>
        )}
      </div>
    </div>
  )
}

export function AutomateEditor() {
  return <ReactFlowProvider><Editor /></ReactFlowProvider>
}
