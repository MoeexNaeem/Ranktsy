'use client'
import '@xyflow/react/dist/style.css'
import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, BackgroundVariant,
  useNodesState, useEdgesState, addEdge, Handle, Position, useReactFlow,
  type Node, type Edge, type Connection, type NodeProps,
} from '@xyflow/react'

/* ─────────────────────────────────────────────────────────────────────────────
   Node-based "Automate Etsy Shop" editor. Build a workflow by adding & connecting
   nodes, configure each, pick a shop, then Execute — the run engine generates one
   SEO listing per product and (if a Create-Draft node is present) pushes each to
   the chosen shop as a draft, one by one.
   ──────────────────────────────────────────────────────────────────────────── */

type NodeKind = 'source' | 'research' | 'title' | 'tags' | 'description' | 'price' | 'image' | 'shop' | 'draft'
type NodeStatus = 'idle' | 'running' | 'done' | 'error'
type WFData = { kind: NodeKind; status: NodeStatus; config: Record<string, unknown> }
type WFNode = Node<WFData>

const ORANGE = '#FB5E09'

function svg(path: React.ReactNode) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
}

const DEFS: Record<NodeKind, { label: string; color: string; role?: string; icon: React.ReactNode; hint: string }> = {
  source:      { label: 'Product Source', color: '#6366F1', role: 'Trigger', hint: 'Where the batch comes from', icon: svg(<><polygon points="5 3 19 12 5 21 5 3" /></>) },
  research:    { label: 'Market Research', color: '#0EA5E9', hint: 'Real competitor / gap / demand data', icon: svg(<><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></>) },
  title:       { label: 'Title', color: '#8B5CF6', hint: 'Keyword-front-loaded title', icon: svg(<><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></>) },
  tags:        { label: '13 Tags', color: '#EC4899', hint: 'The 13 highest-value tags', icon: svg(<><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></>) },
  description: { label: 'Description', color: '#14B8A6', hint: 'Persuasive, structured copy', icon: svg(<><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="14" y2="18" /></>) },
  price:       { label: 'Price', color: '#22C55E', hint: 'Market-anchored price', icon: svg(<><line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>) },
  image:       { label: 'Image', color: '#F59E0B', hint: 'Hero image (coming soon)', icon: svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="m21 15-5-5L5 21" /></>) },
  shop:        { label: 'Shop', color: '#3B82F6', hint: 'Which connected shop to use', icon: svg(<><path d="M4 9V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4" /><path d="M3 9h18l-1.2 4a2 2 0 0 1-2 1.5H6.2a2 2 0 0 1-2-1.5L3 9z" /><path d="M5 14v6h14v-6" /></>) },
  draft:       { label: 'Create Draft', color: ORANGE, hint: 'Upload each to Etsy as a draft', icon: svg(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>) },
}

const STATUS_RING: Record<NodeStatus, string> = { idle: 'transparent', running: ORANGE, done: '#22C55E', error: '#DC2626' }

/* ── Custom node: circular icon + label, with a status ring ─────────────────── */
function WorkflowNode({ data, selected }: NodeProps<WFNode>) {
  const def = DEFS[data.kind]
  const isSource = data.kind === 'source'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 96 }}>
      {!isSource && <Handle type="target" position={Position.Left} style={{ background: '#fff', width: 14, height: 14, border: `2.5px solid ${def.color}` }} />}
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
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2430', lineHeight: 1.2 }}>{def.label}</div>
        {def.role && <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: def.color, marginTop: 2 }}>{def.role}</div>}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: def.color, width: 14, height: 14, border: '2.5px solid #fff', boxShadow: `0 0 0 1.5px ${def.color}` }} />
      <style>{`@keyframes rkspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const nodeTypes = { wf: WorkflowNode }

/* ── Palette of addable nodes ──────────────────────────────────────────────── */
const PALETTE: NodeKind[] = ['source', 'research', 'title', 'tags', 'description', 'price', 'image', 'shop', 'draft']

let idSeq = 1
const newId = () => `n${idSeq++}`

type Shop = { shopId: string; shopName: string }
type Taxonomy = { id: number; name: string; fullPath: string; level: number }
type RunItem = { idx: number; keyword: string; status: string; title: string | null; tags: string[]; price: number | null; listingUrl: string | null; error: string | null }
type Run = { id: string; status: string; total: number; done: number; errored: number; items: RunItem[] }

const panelInput: React.CSSProperties = { width: '100%', fontSize: 13.5, fontFamily: 'inherit', color: '#1f2430', background: '#fff', border: '1px solid #e2e5ec', borderRadius: 9, padding: '9px 11px', outline: 'none' }
const panelLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }

function Editor() {
  const rf = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState<WFNode>([
    { id: 'source', type: 'wf', position: { x: 80, y: 180 }, data: { kind: 'source', status: 'idle', config: { mode: 'niche', niche: '', seeds: '', count: 5, geo: 'US' } } },
  ])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId] = useState<string | null>('source')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState('')

  const { data: shops } = useQuery({ queryKey: ['etsy-shops'], queryFn: async () => (await axios.get('/api/etsy/shops')).data.data as Shop[], staleTime: 60_000 })
  const { data: taxonomy } = useQuery({ queryKey: ['etsy-taxonomy'], queryFn: async () => (await axios.get('/api/etsy/taxonomy')).data.data as Taxonomy[], staleTime: 3_600_000, enabled: nodes.some(n => n.data.kind === 'draft') })

  const onConnect = useCallback((c: Connection) => setEdges(eds => addEdge({ ...c, animated: true, style: { stroke: '#c3c8d4', strokeWidth: 2 } }, eds)), [setEdges])

  const addNode = useCallback((kind: NodeKind) => {
    setPaletteOpen(false); setErr('')
    if (kind === 'source' && nodes.some(n => n.data.kind === 'source')) { setErr('Only one Product Source node is allowed.'); return }
    const id = newId()
    // Chain from the selected node (or the right-most node) so the flow reads left→right.
    const from = nodes.find(n => n.id === selectedId) ?? nodes.reduce<WFNode | null>((r, n) => (!r || n.position.x > r.position.x ? n : r), null)
    const pos = from ? { x: from.position.x + 200, y: from.position.y } : { x: 120, y: 200 }
    const config: Record<string, unknown> =
      kind === 'draft' ? { taxonomyId: '', listingType: 'physical', whoMade: 'i_did', quantity: 1 }
      : kind === 'shop' ? { shopId: '' }
      : {}
    setNodes(ns => ns.concat({ id, type: 'wf', position: pos, data: { kind, status: 'idle', config } }))
    // Auto-connect so you don't have to drag — you can still add/remove edges by hand.
    if (from && from.id !== id) {
      setEdges(es => addEdge({ id: `e-${from.id}-${id}`, source: from.id, target: id, animated: true, style: { stroke: '#c3c8d4', strokeWidth: 2 } }, es))
    }
    setSelectedId(id)
    setTimeout(() => rf.fitView({ duration: 300, padding: 0.2 }), 60)
  }, [nodes, selectedId, rf, setNodes, setEdges])

  const selected = nodes.find(n => n.id === selectedId) ?? null
  const setConfig = useCallback((patch: Record<string, unknown>) => {
    if (!selectedId) return
    setNodes(ns => ns.map(n => n.id === selectedId ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n))
  }, [selectedId, setNodes])

  const setAllStatus = useCallback((fn: (k: NodeKind) => NodeStatus) => {
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, status: fn(n.data.kind) } })))
  }, [setNodes])

  const execute = useCallback(async () => {
    setErr(''); setRun(null)
    const source = nodes.find(n => n.data.kind === 'source')
    if (!source) { setErr('Add a Product Source node.'); return }
    const draftNode = nodes.find(n => n.data.kind === 'draft')
    const shopNode = nodes.find(n => n.data.kind === 'shop')
    const sc = source.data.config
    if (draftNode) {
      if (!shopNode || !shopNode.data.config.shopId) { setErr('A Create-Draft node needs a Shop node with a shop selected.'); return }
      if (!draftNode.data.config.taxonomyId) { setErr('Pick a category on the Create-Draft node.'); return }
    }
    setRunning(true)
    setAllStatus(k => (k === 'source' ? 'running' : 'idle'))
    try {
      const seeds = String(sc.seeds ?? '').split('\n').map(s => s.trim()).filter(Boolean)
      const payload = {
        mode: sc.mode,
        niche: sc.mode === 'niche' ? sc.niche : undefined,
        seeds: sc.mode === 'keywords' ? seeds : undefined,
        count: Number(sc.count) || 5,
        geo: sc.geo || 'US',
        publishToEtsy: !!draftNode,
        shopId: shopNode?.data.config.shopId,
        taxonomyId: draftNode ? Number(draftNode.data.config.taxonomyId) : undefined,
        listingType: draftNode?.data.config.listingType,
        whoMade: draftNode?.data.config.whoMade,
        quantity: draftNode ? Number(draftNode.data.config.quantity) || 1 : 1,
      }
      const { data } = await axios.post('/api/automation/runs', payload)
      if (!data.success) { setErr(data.error || 'Could not start.'); setRunning(false); setAllStatus(() => 'idle'); return }
      setAllStatus(k => (k === 'source' ? 'done' : (k === 'draft' ? 'running' : 'running')))
      const id: string = data.data.id
      let status = 'running'
      while (status === 'running' || status === 'pending') {
        const step = await axios.post(`/api/automation/runs/${id}/step`).then(r => r.data).catch(() => null)
        if (!step?.success) { setErr(step?.error || 'A step failed.'); break }
        setRun(step.data as Run)
        status = step.data.status
        await new Promise(r => setTimeout(r, 200))
      }
      setAllStatus(() => 'done')
    } catch (e) {
      setErr(axios.isAxiosError(e) ? (e.response?.data?.error as string) || 'Request failed.' : 'Request failed.')
      setAllStatus(() => 'error')
    } finally {
      setRunning(false)
    }
  }, [nodes, setAllStatus])

  const taxMatches = useMemo(() => {
    const q = String(selected?.data.config.taxQuery ?? '').trim().toLowerCase()
    return (taxonomy ?? []).filter(t => !q || t.fullPath.toLowerCase().includes(q)).slice(0, 60)
  }, [taxonomy, selected])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f4f5f8', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #e6e8ee', background: '#fff', zIndex: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: ORANGE, background: `${ORANGE}18`, padding: '4px 10px', borderRadius: 100 }}>Hidden · admin</span>
        <strong style={{ fontSize: 16, color: '#1f2430' }}>Automate Etsy Shop</strong>
        <span style={{ fontSize: 13, color: '#8a90a0' }}>Build a workflow, then execute</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button onClick={() => setPaletteOpen(o => !o)} style={{ background: '#fff', border: '1px solid #d7dbe4', borderRadius: 9, padding: '8px 14px', fontSize: 13.5, fontWeight: 600, color: '#1f2430', cursor: 'pointer' }}>+ Add node</button>
          <button onClick={execute} disabled={running} style={{ background: running ? '#9aa0ad' : ORANGE, color: '#fff', border: 'none', borderRadius: 9, padding: '8px 20px', fontSize: 13.5, fontWeight: 600, cursor: running ? 'progress' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            {running ? 'Executing…' : 'Execute'}
          </button>
        </div>
      </div>

      {err && <div style={{ background: '#fff0f0', color: '#c0271e', fontSize: 13, padding: '9px 18px', borderBottom: '1px solid #f3d6d2' }}>{err}</div>}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#d3d7e0" />
            <Controls showInteractive={false} />
          </ReactFlow>

          {/* Palette popover */}
          {paletteOpen && (
            <div style={{ position: 'absolute', top: 12, right: 12, width: 300, background: '#fff', border: '1px solid #e2e5ec', borderRadius: 14, boxShadow: '0 20px 50px rgba(30,30,50,0.16)', overflow: 'hidden', zIndex: 20 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #eef0f4', fontSize: 12.5, fontWeight: 600, color: '#6b7280' }}>Add a node</div>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {PALETTE.map(k => (
                  <button key={k} onClick={() => addNode(k)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f4f5f8', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: `${DEFS[k].color}18`, color: DEFS[k].color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{DEFS[k].icon}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#1f2430' }}>{DEFS[k].label}{DEFS[k].role ? ` · ${DEFS[k].role}` : ''}</span>
                      <span style={{ display: 'block', fontSize: 12, color: '#8a90a0' }}>{DEFS[k].hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom node toolbar — quick-add (each button drops a node, auto-connected) */}
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e2e5ec', borderRadius: 14, padding: '8px 10px', boxShadow: '0 14px 36px rgba(30,30,50,0.14)', zIndex: 15 }}>
            {PALETTE.map(k => (
              <button key={k} title={`Add ${DEFS[k].label}`} onClick={() => addNode(k)}
                style={{ width: 40, height: 40, borderRadius: 11, border: 'none', background: `${DEFS[k].color}14`, color: DEFS[k].color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = `${DEFS[k].color}28`)}
                onMouseLeave={e => (e.currentTarget.style.background = `${DEFS[k].color}14`)}>
                {DEFS[k].icon}
              </button>
            ))}
          </div>
        </div>

        {/* Config drawer */}
        {selected && (
          <aside style={{ width: 320, background: '#fff', borderLeft: '1px solid #e6e8ee', padding: 18, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: `${DEFS[selected.data.kind].color}18`, color: DEFS[selected.data.kind].color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{DEFS[selected.data.kind].icon}</span>
              <strong style={{ fontSize: 15, color: '#1f2430' }}>{DEFS[selected.data.kind].label}</strong>
              {selected.data.kind !== 'source' && (
                <button onClick={() => { setNodes(ns => ns.filter(n => n.id !== selected.id)); setEdges(es => es.filter(e => e.source !== selected.id && e.target !== selected.id)); setSelectedId(null) }}
                  style={{ marginLeft: 'auto', fontSize: 12, color: '#c0271e', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              )}
            </div>

            {selected.data.kind === 'source' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['niche', 'keywords'] as const).map(m => (
                    <button key={m} onClick={() => setConfig({ mode: m })} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${selected.data.config.mode === m ? ORANGE : '#e2e5ec'}`, background: selected.data.config.mode === m ? `${ORANGE}12` : '#fff', color: selected.data.config.mode === m ? ORANGE : '#6b7280', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>{m === 'niche' ? 'Niche (AI picks)' : 'My keywords'}</button>
                  ))}
                </div>
                {selected.data.config.mode === 'keywords' ? (
                  <div><label style={panelLabel}>Keywords (one per line)</label><textarea value={String(selected.data.config.seeds ?? '')} onChange={e => setConfig({ seeds: e.target.value })} rows={5} style={{ ...panelInput, resize: 'vertical' }} placeholder={'ceramic coffee mug\npersonalized dog bandana'} /></div>
                ) : (
                  <div><label style={panelLabel}>Niche</label><input value={String(selected.data.config.niche ?? '')} onChange={e => setConfig({ niche: e.target.value })} style={panelInput} placeholder="minimalist nursery wall art" /></div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={panelLabel}>Products</label><input value={String(selected.data.config.count ?? 5)} onChange={e => setConfig({ count: e.target.value })} inputMode="numeric" style={panelInput} /></div>
                  <div><label style={panelLabel}>Market</label><input value={String(selected.data.config.geo ?? 'US')} onChange={e => setConfig({ geo: e.target.value.toUpperCase().slice(0, 3) })} style={panelInput} /></div>
                </div>
              </div>
            )}

            {selected.data.kind === 'shop' && (
              <div>
                <label style={panelLabel}>Upload to shop</label>
                <select value={String(selected.data.config.shopId ?? '')} onChange={e => setConfig({ shopId: e.target.value })} style={panelInput}>
                  <option value="">{shops?.length ? 'Select a shop' : 'No connected shops'}</option>
                  {(shops ?? []).map(s => <option key={s.shopId} value={s.shopId}>{s.shopName}</option>)}
                </select>
                <p style={{ fontSize: 12, color: '#8a90a0', marginTop: 8, lineHeight: 1.5 }}>Connect shops in the dashboard → My Shop. Needed only when a Create-Draft node is present.</p>
              </div>
            )}

            {selected.data.kind === 'draft' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={panelLabel}>Category (all products)</label>
                  <input value={String(selected.data.config.taxQuery ?? '')} onChange={e => setConfig({ taxQuery: e.target.value })} placeholder="Search categories…" style={{ ...panelInput, marginBottom: 8 }} />
                  <select value={String(selected.data.config.taxonomyId ?? '')} onChange={e => setConfig({ taxonomyId: e.target.value })} style={panelInput}>
                    <option value="">Select a category</option>
                    {taxMatches.map(t => <option key={t.id} value={t.id}>{t.fullPath}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={panelLabel}>Type</label>
                    <select value={String(selected.data.config.listingType ?? 'physical')} onChange={e => setConfig({ listingType: e.target.value })} style={panelInput}><option value="physical">Physical</option><option value="download">Digital</option></select></div>
                  <div><label style={panelLabel}>Quantity</label><input value={String(selected.data.config.quantity ?? 1)} onChange={e => setConfig({ quantity: e.target.value })} inputMode="numeric" style={panelInput} /></div>
                </div>
                <div><label style={panelLabel}>Who made it</label>
                  <select value={String(selected.data.config.whoMade ?? 'i_did')} onChange={e => setConfig({ whoMade: e.target.value })} style={panelInput}><option value="i_did">I did</option><option value="someone_else">Another</option></select></div>
                <p style={{ fontSize: 12, color: '#8a90a0', lineHeight: 1.5 }}>Drafts only — they land in your Etsy Drafts to review & publish. Needs the Shop node.</p>
              </div>
            )}

            {['research', 'title', 'tags', 'description', 'price', 'image'].includes(selected.data.kind) && (
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                {DEFS[selected.data.kind].hint}. Connect it into the flow after the Product Source. {selected.data.kind === 'image' ? 'Image generation is coming next.' : 'It’s produced automatically from the real market data for each product.'}
              </p>
            )}
          </aside>
        )}

        {!selected && (
          <aside style={{ width: 320, background: '#fff', borderLeft: '1px solid #e6e8ee', padding: 20, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1f2430', marginBottom: 6 }}>How it works</h3>
            <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 14 }}>Build a left-to-right flow, configure each node, then Execute.</p>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 10 }}>
              {([
                ['Add nodes', 'Use the bar at the bottom (or “+ Add node”). Each new node auto-connects to the last one.'],
                ['Set values', 'Click a node to open its settings here — the niche & count on Product Source, the shop on Shop, the category on Create Draft.'],
                ['Rewire (optional)', 'Drag from the dot on a node’s right edge onto another node’s left dot to connect them by hand.'],
                ['Execute', 'Researches the market, writes a full SEO listing per product, and — if a Create Draft node is present — uploads each to your chosen shop as a draft.'],
              ] as const).map(([t, d]) => (
                <li key={t} style={{ fontSize: 13, color: '#3a4051', lineHeight: 1.55 }}><strong style={{ color: '#1f2430' }}>{t}.</strong> {d}</li>
              ))}
            </ol>
            <p style={{ fontSize: 12, color: '#8a90a0', lineHeight: 1.55, marginTop: 16 }}>Minimum to run: a Product Source. To publish drafts, also add Shop + Create Draft.</p>
          </aside>
        )}
      </div>

      {/* Results panel */}
      {run && (
        <div style={{ position: 'absolute', left: 18, bottom: 18, width: 360, maxHeight: '55vh', background: '#fff', border: '1px solid #e2e5ec', borderRadius: 14, boxShadow: '0 20px 50px rgba(30,30,50,0.16)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #eef0f4' }}>
            <strong style={{ fontSize: 14, color: '#1f2430' }}>Run · {run.done}/{run.total}{run.errored ? ` · ${run.errored} failed` : ''}</strong>
            <button onClick={() => setRun(null)} style={{ background: 'none', border: 'none', color: '#8a90a0', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {run.items.map(it => (
              <div key={it.idx} style={{ display: 'flex', gap: 9, padding: '9px 11px', background: '#f7f8fb', borderRadius: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: it.status === 'done' ? '#22C55E' : it.status === 'error' ? '#DC2626' : it.status === 'running' ? ORANGE : '#b9bfca' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2430' }}>{it.keyword}</span>
                    {it.price != null && <span style={{ fontSize: 11.5, color: '#22C55E' }}>${it.price}</span>}
                    {it.listingUrl && <a href={it.listingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: ORANGE, fontWeight: 600 }}>Open draft →</a>}
                  </div>
                  {it.title && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</p>}
                  {it.error && <p style={{ fontSize: 11.5, color: '#DC2626', marginTop: 2 }}>{it.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AutomateEditor() {
  return <ReactFlowProvider><Editor /></ReactFlowProvider>
}
