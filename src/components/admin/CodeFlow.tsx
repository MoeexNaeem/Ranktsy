'use client'

/**
 * Code Flow - a live, animated map of how the app works end to end.
 *
 * IMPORTANT: this uses reactflow v11 (NOT @xyflow/react v12). v12's node
 * measurement is unreliable in this Next/React stack, which leaves edges
 * unrendered (the "no connecting lines" bug). v11 measures via a ResizeObserver
 * and draws edges reliably - the same choice the automation editor made. See
 * AutomateEditor.tsx.
 *
 * The diagram is data-driven from lib/codeflow/graph.ts - add a node + edge there
 * to extend it. Every node/edge is coloured live from /api/admin/health-flow:
 * green = working, amber = optional service off, red = broken required system.
 * Connections are animated so flow direction is visible.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  Handle, Position, MarkerType, useStoreApi,
  type Node, type Edge, type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { FLOW_NODES, FLOW_EDGES, SYSTEM_LABEL, type FlowNodeDef, type FlowSystem, type FlowNodeKind } from '@/lib/codeflow/graph'

type Status = 'ok' | 'down' | 'off'
interface SystemHealth { status: Status; required: boolean; detail: string }
type HealthMap = Record<FlowSystem, SystemHealth>

type NodeState = 'ok' | 'down' | 'off' | 'code'
function nodeState(def: FlowNodeDef, health: HealthMap | null): NodeState {
  if (!def.system) return 'code'
  if (!health) return 'code'
  return health[def.system]?.status ?? 'code'
}

// Light theme - readable dark text on white cards, health carried by a coloured
// border + a status dot + the connecting line into the node.
const COLOR: Record<NodeState, { line: string; dot: string; tint: string }> = {
  ok:   { line: '#16a34a', dot: '#22c55e', tint: '#f0fdf4' },
  down: { line: '#dc2626', dot: '#ef4444', tint: '#fef2f2' },
  off:  { line: '#d97706', dot: '#f59e0b', tint: '#fffbeb' },
  code: { line: '#64748b', dot: '#94a3b8', tint: '#ffffff' },
}
const EDGE_COLOR: Record<NodeState, string> = { ok: '#16a34a', down: '#dc2626', off: '#e0a52c', code: '#64748b' }

interface NodeData { label: string; kind: FlowNodeKind; state: NodeState; detail?: string }

// One custom node - shape from `kind`, colour from `state`. A single target (top)
// + single source (bottom) handle so every edge resolves and the line draws.
function FlowNode({ data }: NodeProps<NodeData>) {
  const c = COLOR[data.state]
  const isDiamond = data.kind === 'decision'
  const isPill = data.kind === 'start' || data.kind === 'terminal'
  const isExternal = data.kind === 'external'
  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: '#1f2430', background: data.state === 'code' ? '#ffffff' : c.tint,
    border: `3px solid ${c.line}`, boxShadow: '0 6px 20px rgba(30,30,40,0.12)',
    fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', position: 'relative',
  }
  const shape: React.CSSProperties = isDiamond
    ? { ...base, width: 220, height: 124, clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', padding: '0 34px', fontSize: 14, background: c.line, color: '#fff' }
    : isPill
      ? { ...base, borderRadius: 999, padding: '16px 28px', minWidth: 190 }
      : { ...base, borderRadius: 14, padding: '18px 24px', minWidth: 220, maxWidth: 250, ...(isExternal ? { borderStyle: 'dashed' } : null) }

  return (
    <div title={data.detail ? `${data.label} - ${data.detail}` : data.label} style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={handleStyle(c.line)} />
      <div style={shape}>
        {/* status dot - visible on the light card even when the border colour is subtle */}
        {!isDiamond && <span style={{ position: 'absolute', top: 8, right: 9, width: 10, height: 10, borderRadius: 999, background: c.dot,
          boxShadow: data.state === 'down' ? `0 0 6px ${c.dot}` : 'none' }} />}
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle(c.line)} />
    </div>
  )
}
const handleStyle = (col: string): React.CSSProperties => ({ width: 12, height: 12, background: '#fff', border: `3px solid ${col}` })

const nodeTypes = { flow: FlowNode }

const DOT: Record<Status, string> = { ok: '#22c55e', down: '#ef4444', off: '#d99a2b' }

function CodeFlowInner() {
  const storeApi = useStoreApi()
  const [health, setHealth] = useState<HealthMap | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  // Fullscreen: the canvas takes over the whole viewport (Esc to exit).
  const [full, setFull] = useState(false)
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [full])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/admin/health-flow', { cache: 'no-store' })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.success) { setHealth(d.data.systems); setCheckedAt(d.data.checkedAt) }
      else setErr(d?.error || 'Failed to load health')
    } catch { setErr('Failed to load health') }
    setLoading(false)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const nodes = useMemo<Node<NodeData>[]>(() => FLOW_NODES.map(n => ({
    id: n.id, type: 'flow', position: n.position, draggable: false,
    data: { label: n.label, kind: n.kind, state: nodeState(n, health), detail: n.detail },
  })), [health])

  const edges = useMemo<Edge[]>(() => {
    const byId = new Map(FLOW_NODES.map(n => [n.id, n]))
    return FLOW_EDGES.map(e => {
      const targetDef = byId.get(e.target)
      const sys = e.system ?? targetDef?.system
      const st: NodeState = sys && health ? (health[sys]?.status ?? 'code') : 'code'
      const col = EDGE_COLOR[st]
      const broken = st === 'down'
      return {
        id: e.id, source: e.source, target: e.target, label: e.label,
        type: 'smoothstep', animated: true,
        style: { stroke: col, strokeWidth: broken ? 4.5 : 3.5 },
        labelStyle: { fill: '#374151', fontSize: 13, fontWeight: 700 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.97, stroke: col, strokeWidth: 1.5 },
        labelBgPadding: [8, 4] as [number, number], labelBgBorderRadius: 6,
        markerEnd: { type: MarkerType.ArrowClosed, color: col, width: 18, height: 18 },
      }
    })
  }, [health])

  // Measurement safety net (see AutomateEditor): nudge v11's own measurement for
  // any node without dimensions so edges always have handle positions to draw to.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let tries = 0
    const tick = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = storeApi.getState() as any
      const internals = st.nodeInternals as Map<string, { width?: number }>
      const updates: { id: string; nodeElement: HTMLElement; forceUpdate: boolean }[] = []
      document.querySelectorAll<HTMLElement>('.react-flow__node').forEach(el => {
        const id = el.getAttribute('data-id')
        if (!id || internals.get(id)?.width) return
        if (el.offsetWidth) updates.push({ id, nodeElement: el, forceUpdate: true })
      })
      if (updates.length) st.updateNodeDimensions(updates)
      if (++tries < 8) timer = setTimeout(tick, 100)
    }
    timer = setTimeout(tick, 30)
    return () => { if (timer) clearTimeout(timer) }
  }, [nodes.length, storeApi])

  const legend = useMemo(() => {
    if (!health) return []
    return (Object.keys(SYSTEM_LABEL) as FlowSystem[])
      .map(sys => ({ sys, ...health[sys] }))
      .sort((a, b) => (a.status === 'down' ? -1 : 0) - (b.status === 'down' ? -1 : 0) || Number(b.required) - Number(a.required))
  }, [health])
  const downCount = legend.filter(l => l.status === 'down').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#3D3E3B' }}>Code Flow</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#6E6E64', maxWidth: 640 }}>
            Live map of the app. Green flows are working, amber is an optional service that is off, red is a broken required system. Scroll to zoom, drag the background to pan.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {downCount > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#CF463A' }}>{downCount} system{downCount === 1 ? '' : 's'} down</span>}
          <span style={{ fontSize: 11, color: '#919183', fontFamily: 'ui-monospace, monospace' }}>{checkedAt ? `checked ${new Date(checkedAt).toLocaleTimeString()}` : ''}</span>
          <button onClick={() => void load()} disabled={loading}
            style={{ background: '#3D3E3B', color: '#fff', border: 'none', borderRadius: 100, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Checking...' : 'Re-check'}
          </button>
        </div>
      </div>

      {err && <div style={{ fontSize: 12.5, color: '#CF463A' }}>{err}</div>}

      {/* Systems strip: full-width chips above the canvas, so the map gets every pixel of width. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {legend.length === 0 && <span style={{ fontSize: 12.5, color: '#919183' }}>Checking systems...</span>}
        {legend.map(l => (
          <span key={l.sys} title={l.detail} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: 999, background: '#fff',
            border: `2px solid ${l.status === 'down' ? DOT.down : l.status === 'off' ? '#ecd29a' : '#cfe9d6'}` }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: DOT[l.status], boxShadow: l.status === 'down' ? `0 0 6px ${DOT.down}` : 'none' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#3D3E3B' }}>{SYSTEM_LABEL[l.sys]}</span>
            <span style={{ fontSize: 11, color: l.status === 'down' ? DOT.down : '#919183', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{l.status === 'ok' ? 'ok' : l.status === 'down' ? 'DOWN' : 'off'}</span>
          </span>
        ))}
        <span style={{ flex: 1 }} />
        {([['#22c55e', 'Working'], ['#d99a2b', 'Optional / off'], ['#ef4444', 'Broken (required)']] as const).map(([col, txt]) => (
          <span key={txt} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: col }} />
            <span style={{ fontSize: 12, color: '#6E6E64' }}>{txt}</span>
          </span>
        ))}
      </div>

      <div style={full
        ? { position: 'fixed', inset: 0, zIndex: 1000, background: '#f6f6ef' }
        : { position: 'relative', height: 'max(780px, calc(100vh - 150px))', borderRadius: 18, overflow: 'hidden', border: '2px solid #BDBDB1', background: '#f6f6ef', boxShadow: '0 10px 30px rgba(30,30,40,0.08)' }}>
        <button onClick={() => setFull(f => !f)} title={full ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', color: '#3D3E3B', border: '2px solid #BDBDB1', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(30,30,40,0.1)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {full
              ? <><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></>
              : <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>}
          </svg>
          {full ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          // minZoom floor keeps nodes readable instead of shrinking to cram the
          // whole graph in; anything off-screen is reachable by pan + the minimap.
          fitView fitViewOptions={{ padding: 0.06, minZoom: 0.6, maxZoom: 1.2 }}
          minZoom={0.25} maxZoom={2.2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          panOnDrag zoomOnScroll>
          <Background variant={BackgroundVariant.Dots} color="#c4c4b8" gap={26} size={1.6} />
          <Controls showInteractive={false} style={{ transform: 'scale(1.25)', transformOrigin: 'bottom left' }} />
          <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.08)"
            nodeColor={(n) => COLOR[(n.data as NodeData).state].line} nodeStrokeWidth={3}
            style={{ background: '#ffffff', border: '2px solid #BDBDB1', borderRadius: 10, width: 240, height: 160 }} />
        </ReactFlow>
      </div>
    </div>
  )
}

export function CodeFlow() {
  return <ReactFlowProvider><CodeFlowInner /></ReactFlowProvider>
}
