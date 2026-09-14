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
    fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: '#1f2430', background: data.state === 'code' ? '#ffffff' : c.tint,
    border: `2px solid ${c.line}`, boxShadow: '0 4px 14px rgba(30,30,40,0.08)',
    fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', position: 'relative',
  }
  const shape: React.CSSProperties = isDiamond
    ? { ...base, width: 168, height: 100, clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', padding: '0 24px', fontSize: 12 }
    : isPill
      ? { ...base, borderRadius: 999, padding: '12px 22px', minWidth: 148 }
      : { ...base, borderRadius: 12, padding: '13px 18px', minWidth: 172, maxWidth: 228, ...(isExternal ? { borderStyle: 'dashed' } : null) }

  return (
    <div title={data.detail ? `${data.label} - ${data.detail}` : data.label} style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={handleStyle(c.line)} />
      <div style={shape}>
        {/* status dot - visible on the light card even when the border colour is subtle */}
        {!isDiamond && <span style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: 999, background: c.dot,
          boxShadow: data.state === 'down' ? `0 0 6px ${c.dot}` : 'none' }} />}
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle(c.line)} />
    </div>
  )
}
const handleStyle = (col: string): React.CSSProperties => ({ width: 9, height: 9, background: '#fff', border: `2px solid ${col}` })

const nodeTypes = { flow: FlowNode }

const DOT: Record<Status, string> = { ok: '#22c55e', down: '#ef4444', off: '#d99a2b' }

function CodeFlowInner() {
  const storeApi = useStoreApi()
  const [health, setHealth] = useState<HealthMap | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

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
        style: { stroke: col, strokeWidth: broken ? 3 : 2.4 },
        labelStyle: { fill: '#4b5563', fontSize: 11, fontWeight: 700 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95 },
        labelBgPadding: [6, 3] as [number, number], labelBgBorderRadius: 5,
        markerEnd: { type: MarkerType.ArrowClosed, color: col, width: 20, height: 20 },
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 230px', gap: 12, alignItems: 'stretch' }}>
        <div style={{ height: '82vh', minHeight: 560, borderRadius: 16, overflow: 'hidden', border: '1px solid #D2D2C8', background: '#f6f6ef' }}>
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            fitView fitViewOptions={{ padding: 0.14, maxZoom: 1 }}
            minZoom={0.3} maxZoom={2.2}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
            panOnDrag zoomOnScroll>
            <Background variant={BackgroundVariant.Dots} color="#cfcfc4" gap={24} size={1.3} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.08)"
              nodeColor={(n) => COLOR[(n.data as NodeData).state].line} nodeStrokeWidth={2}
              style={{ background: '#ffffff', border: '1px solid #D2D2C8' }} />
          </ReactFlow>
        </div>

        <aside style={{ border: '1px solid #D2D2C8', borderRadius: 14, padding: 14, background: '#F5F5EB', alignSelf: 'start' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#3D3E3B', marginBottom: 10 }}>Systems</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {legend.length === 0 && <span style={{ fontSize: 12, color: '#919183' }}>Loading...</span>}
            {legend.map(l => (
              <div key={l.sys} title={l.detail} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: DOT[l.status], flexShrink: 0, boxShadow: l.status === 'down' ? `0 0 6px ${DOT.down}` : 'none' }} />
                <span style={{ fontSize: 12, color: '#3D3E3B', flex: 1 }}>{SYSTEM_LABEL[l.sys]}</span>
                <span style={{ fontSize: 10, color: '#919183', fontFamily: 'ui-monospace, monospace' }}>{l.status === 'ok' ? 'ok' : l.status === 'down' ? 'DOWN' : 'off'}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #D2D2C8', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {([['#22c55e', 'Working'], ['#d99a2b', 'Optional / off'], ['#ef4444', 'Broken (required)']] as const).map(([col, txt]) => (
              <div key={txt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: col }} />
                <span style={{ fontSize: 11.5, color: '#6E6E64' }}>{txt}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

export function CodeFlow() {
  return <ReactFlowProvider><CodeFlowInner /></ReactFlowProvider>
}
