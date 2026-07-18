// TATVA: pure mapping between the CRM Workflow Definition graph and the Vue Flow canvas.
// One source of truth for the graph is the doctype (nodes child table). Layout (x/y + viewport) is
// presentation only and lives in canvas_json, never in the frozen version payload. These helpers are
// framework-free so they can be unit-tested and can never drift from the backend edge model.
import dagre from '@dagrejs/dagre'

// The five node types' OUTPUT handles — the one thing not derivable from field meta. A handle id maps
// 1:1 to the edge field it writes on the node row, so the canvas and the engine can never disagree.
export const HANDLE_TO_FIELD = {
  next: 'next_node',
  on_true: 'on_true',
  on_false: 'on_false',
  on_event: 'on_event',
  on_timeout: 'on_timeout',
}
const EDGE_FIELDS = ['next_node', 'on_true', 'on_false', 'on_event', 'on_timeout']

const TIMER_WAIT_MODES = ['For Duration', 'Until Time']

// Source handles a node exposes, derived from node_type (+ wait_mode for Wait). Terminal has none.
export function handlesForNode(node) {
  switch (node.node_type) {
    case 'Branch':
      return [
        { id: 'on_true', label: 'true' },
        { id: 'on_false', label: 'false' },
      ]
    case 'Wait':
      if (node.wait_mode === 'Until Event')
        return [{ id: 'on_event', label: 'event' }]
      if (node.wait_mode === 'Event-or-Timeout')
        return [
          { id: 'on_event', label: 'event' },
          { id: 'on_timeout', label: 'timeout' },
        ]
      // For Duration / Until Time (and unset) → a single timer edge.
      return [{ id: 'next', label: '' }]
    case 'Terminal':
      return []
    case 'Step':
    case 'Assign':
    default:
      return [{ id: 'next', label: '' }]
  }
}

const NODE_W = 220
const NODE_H = 88

// Lay out any nodes that have no saved position, so a fresh graph never lands in a pile at 0,0.
// Saved positions always win; only the missing ones get dagre-placed.
function autoLayout(flowNodes, flowEdges) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90 })
  g.setDefaultEdgeLabel(() => ({}))
  flowNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  flowEdges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  const out = {}
  flowNodes.forEach((n) => {
    const p = g.node(n.id)
    // dagre gives the node centre; Vue Flow positions by top-left.
    if (p) out[n.id] = { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 }
  })
  return out
}

// Definition (rows + canvas_json) → Vue Flow { nodes, edges }.
export function definitionToFlow(nodeRows, canvasJson) {
  const positions = (canvasJson && canvasJson.positions) || {}
  const flowNodes = (nodeRows || []).map((n) => ({
    id: n.node_id,
    type: 'campaign',
    position: positions[n.node_id] || null,
    data: { node: { ...n } },
  }))

  const flowEdges = []
  for (const n of nodeRows || []) {
    for (const h of handlesForNode(n)) {
      const target = n[HANDLE_TO_FIELD[h.id]]
      if (target)
        flowEdges.push({
          id: `${n.node_id}__${h.id}`,
          source: n.node_id,
          sourceHandle: h.id,
          target,
          label: h.label || undefined,
        })
    }
  }

  const missing = flowNodes.filter((n) => !n.position)
  if (missing.length) {
    const placed = autoLayout(flowNodes, flowEdges)
    missing.forEach((n) => {
      n.position = placed[n.id] || { x: 0, y: 0 }
    })
  }
  return { flowNodes, flowEdges }
}

// Vue Flow live state → { nodes: rows, canvas: {positions, viewport} } for a standard document save.
// Config fields are preserved from data.node; the 5 edge fields are recomputed from the edges so the
// canvas is the sole author of connectivity.
export function flowToDefinition(flowNodes, flowEdges, viewport) {
  const bySource = {}
  for (const e of flowEdges) {
    const field = HANDLE_TO_FIELD[e.sourceHandle]
    if (!field) continue
    ;(bySource[e.source] = bySource[e.source] || {})[field] = e.target
  }

  const positions = {}
  const nodes = flowNodes.map((fn) => {
    const row = { ...(fn.data?.node || {}) }
    EDGE_FIELDS.forEach((f) => {
      row[f] = ''
    })
    Object.assign(row, bySource[fn.id] || {})
    positions[fn.id] = { x: Math.round(fn.position.x), y: Math.round(fn.position.y) }
    return row
  })

  return { nodes, canvas: { positions, viewport: viewport || null } }
}
