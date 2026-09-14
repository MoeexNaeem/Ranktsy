'use client'

/**
 * Code Flow - an animated, live-health map of how the app works end to end.
 *
 * The diagram is data-driven: it renders whatever is in lib/codeflow/graph.ts, so
 * adding a step later is a data edit, not a UI change. Every node/edge is coloured
 * from /api/admin/health-flow: green = working, red = a REQUIRED system is down,
 * amber = an OPTIONAL system is not configured. Healthy connections animate; a red
 * (broken) connection animates red so it's impossible to miss.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Handle, Position, MarkerType,
  type Node, type Edge, type NodeProps, type DefaultEdgeOptions,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FLOW_NODES, FLOW_EDGES, SYSTEM_LABEL, type FlowNodeDef, type FlowSystem, type FlowNodeKind } from '@/lib/codeflow/graph'

type Status = 'ok' | 'down' | 'off'
interface SystemHealth { status: Status; required: boolean; detail: string }
type HealthMap = Record<FlowSystem, SystemHealth>

// Health of a node = health of its system. Nodes with no system are pure code:
// they're "ok" as long as the app is deployed (they can't fail on their own).
type NodeState = 'ok' | 'down' | 'off' | 'code'
function nodeState(def: FlowNodeDef, health: HealthMap | null): NodeState {
  if (!def.system) return 'code'
  if (!health) return 'code'
  return health[def.system]?.status ?? 'code'
}

// Colours tuned for readability on the dark canvas: a saturated border/accent, a
// deep-but-legible fill, near-white text.
const COLOR: Record<NodeState, { line: string; fill: string; text: string; glow: string }> = {
  ok:   { line: '#34d27b', fill: '#132a1f', text: '#eafff2', glow: 'rgba(52,210,123,0.40)' },
  down: { line: '#ff5a4d', fill: '#2e1513', text: '#ffe9e6', glow: 'rgba(255,90,77,0.55)' },
  off:  { line: '#e6a53a', fill: '#2b2110', text: '#fff2da', glow: 'rgba(230,165,58,0.35)' },
  code: { line: '#9fb4d8', fill: '#1a2233', text: '#eaf1ff', glow: 'rgba(159,180,216,0.0)' },
}

interface NodeData extends Record<string, unknown> {
  label: string; kind: FlowNodeKind; state: NodeState; detail?: string; system?: FlowSystem
}

// One custom node renderer for every shape - shape from `kind`, colour from `state`.
// A single target handle (top) + single source handle (bottom) so every edge
// resolves unambiguously and the connecting lines always render.
function FlowNode({ data }: NodeProps<Node<NodeData>>) {
  const c = COLOR[data.state]
  const isDiamond = data.kind === 'decision'
  const isPill = data.kind === 'start' || data.kind === 'terminal'
  const isExternal = data.kind === 'external'
  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    fontSize: 13, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.1,
    color: c.text, background: c.fill, border: `2px solid ${c.line}`,
    boxShadow: data.state === 'down' ? `0 0 0 1px ${c.line}, 0 0 22px ${c.glow}`
             : data.state === 'ok'   ? `0 0 16px ${c.glow}` : '0 2px 8px rgba(0,0,0,0.35)',
    fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
  }
  const shape: React.CSSProperties = isDiamond
    ? { ...base, width: 176, height: 108, clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', padding: '0 26px', fontSize: 12 }
    : isPill
      ? { ...base, borderRadius: 999, padding: '12px 22px', minWidth: 150 }
      : { ...base, borderRadius: 12, padding: '13px 18px', minWidth: 176, maxWidth: 230,
          ...(isExternal ? { borderStyle: 'dashed' } : null) }

  return (
    <div title={data.detail ? `${data.label} - ${data.detail}` : data.label} style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div style={shape}>{data.label}</div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  )
}
const handleStyle: React.CSSProperties = { width: 7, height: 7, background: '#5b6b86', border: '1px solid #0b1020' }

const nodeTypes = { flow: FlowNode }
const defaultEdgeOptions: DefaultEdgeOptions = { type: 'smoothstep' }

const DOT: Record<Status, string> = { ok: '#22c55e', down: '#ef4444', off: '#d99a2b' }

export function CodeFlow() {
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
    id: n.id,
    type: 'flow',
    position: n.position,
    data: { label: n.label, kind: n.kind, state: nodeState(n, health), detail: n.detail, system: n.system },
  })), [health])

  const edges = useMemo<Edge[]>(() => {
    const byId = new Map(FLOW_NODES.map(n => [n.id, n]))
    return FLOW_EDGES.map(e => {
      const targetDef = byId.get(e.target)
      const sys = e.system ?? targetDef?.system
      const st: NodeState = sys && health ? (health[sys]?.status ?? 'code') : 'code'
      const col = st === 'down' ? COLOR.down.line : st === 'off' ? COLOR.off.line : st === 'ok' ? COLOR.ok.line : COLOR.code.line
      const broken = st === 'down'
      return {
        id: e.id, source: e.source, target: e.target, label: e.label,
        // Always animated: the moving dashes show flow direction and make the
        // connections easy to trace. Colour still carries health.
        type: 'smoothstep', animated: true,
        style: { stroke: col, strokeWidth: broken ? 3 : 2, opacity: st === 'off' ? 0.85 : 1 },
        labelStyle: { fill: '#cdd7ea', fontSize: 11, fontWeight: 600, fontFamily: 'system-ui, sans-serif' },
        labelBgStyle: { fill: '#0b1020', fillOpacity: 0.9 },
        labelBgPadding: [6, 3] as [number, number], labelBgBorderRadius: 4,
        markerEnd: { type: MarkerType.ArrowClosed, color: col, width: 20, height: 20 },
      }
    })
  }, [health])

  // Systems legend, broken first, then required, then the rest.
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
            Live map of the app. Green flows are working, amber is an optional service that is off, red is a broken required system. Scroll to zoom, drag to pan.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {downCount > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#CF463A' }}>{downCount} system{downCount === 1 ? '' : 's'} down</span>}
          <span style={{ fontSize: 11, color: '#919183', fontFamily: 'ui-monospace, monospace' }}>
            {checkedAt ? `checked ${new Date(checkedAt).toLocaleTimeString()}` : ''}
          </span>
          <button onClick={() => void load()} disabled={loading}
            style={{ background: '#3D3E3B', color: '#fff', border: 'none', borderRadius: 100, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Checking...' : 'Re-check'}
          </button>
        </div>
      </div>

      {err && <div style={{ fontSize: 12.5, color: '#CF463A' }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 230px', gap: 12, alignItems: 'stretch' }}>
        <div style={{ height: '82vh', minHeight: 560, borderRadius: 16, overflow: 'hidden',
          border: '1px solid #2a3446', background: 'radial-gradient(1200px 600px at 30% 0%, #17203260, transparent), #0e1422' }}>
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes} defaultEdgeOptions={defaultEdgeOptions}
            fitView fitViewOptions={{ padding: 0.16 }}
            minZoom={0.25} maxZoom={2.2}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          >
            <Background variant={BackgroundVariant.Dots} color="#2b3750" gap={26} size={1.4} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable maskColor="rgba(0,0,0,0.6)"
              nodeColor={(n) => COLOR[(n.data as NodeData).state].line}
              nodeStrokeWidth={2} style={{ background: '#0b1020', border: '1px solid #2a3446' }} />
          </ReactFlow>
        </div>

        <aside style={{ border: '1px solid #D2D2C8', borderRadius: 14, padding: 14, background: '#F5F5EB', alignSelf: 'start' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#3D3E3B', marginBottom: 10 }}>Systems</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {legend.length === 0 && <span style={{ fontSize: 12, color: '#919183' }}>Loading...</span>}
            {legend.map(l => (
              <div key={l.sys} title={l.detail} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: DOT[l.status], flexShrink: 0,
                  boxShadow: l.status === 'down' ? `0 0 6px ${DOT.down}` : 'none' }} />
                <span style={{ fontSize: 12, color: '#3D3E3B', flex: 1 }}>{SYSTEM_LABEL[l.sys]}</span>
                <span style={{ fontSize: 10, color: '#919183', fontFamily: 'ui-monospace, monospace' }}>
                  {l.status === 'ok' ? 'ok' : l.status === 'down' ? 'DOWN' : 'off'}
                </span>
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
