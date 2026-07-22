// TATVA: pure mapping between the CRM Workflow graph and the Vue Flow canvas.
import dagre from '@dagrejs/dagre'

// Must match the card in WorkflowNode.vue — every card is the same size, so the layout can assume it.
const NODE_W = 260
const NODE_H = 112

// Lay out any nodes that have no saved position, so a fresh graph never lands in a pile at 0,0.
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

// A node's own settings.
export function configOf(node) {
  try {
    return JSON.parse(node?.config_json || '{}') || {}
  } catch {
    return {}
  }
}

// Latest-wins sequencing for an answer the canvas DELETES from: a superseded caller gets the WINNER's answer, never null and never a cached one — returning null made its caller substitute the previous answer, which deleted valid branches the moment their handles came back.
export function latestOnly(fetcher) {
  let issued = 0
  let winner = null
  return async function (...args) {
    const token = ++issued
    winner = fetcher(...args)
    const answer = await winner
    return token === issued ? answer : winner
  }
}

// The output handles this node draws, from the backend's resolved answer. `outputsByNode` is
// {node_id: [output]} exactly as `registry.graph_outputs` returns it — this file resolves nothing.
export function handlesForNode(node, outputsByNode) {
  const outputs = outputsByNode?.[node.node_id] || []
  return outputs.map((name) => ({ id: name, label: outputs.length > 1 ? name : '' }))
}

// Node rows (+ canvas_json) → Vue Flow { nodes, edges }.
export function definitionToFlow(nodeRows, canvasJson, outputsByNode) {
  const positions = (canvasJson && canvasJson.positions) || {}
  const flowNodes = (nodeRows || []).map((n) => ({
    id: n.node_id,
    type: 'workflow',
    position: positions[n.node_id] || null,
    data: { node: { ...n } },
  }))

  const flowEdges = []
  for (const n of nodeRows || []) {
    const labels = {}
    for (const h of handlesForNode(n, outputsByNode)) labels[h.id] = h.label
    for (const edge of n.edges || []) {
      if (!edge.to_node) continue
      flowEdges.push({
        id: `${n.node_id}__${edge.from_output}`,
        source: n.node_id,
        sourceHandle: edge.from_output,
        target: edge.to_node,
        label: labels[edge.from_output] || undefined,
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

// Vue Flow live state → { nodes: rows, canvas: {positions, viewport} }.
export function flowToDefinition(flowNodes, flowEdges, viewport) {
  const bySource = {}
  for (const e of flowEdges) {
    if (!e.sourceHandle) continue
    ;(bySource[e.source] = bySource[e.source] || []).push({
      from_output: e.sourceHandle,
      to_node: e.target,
    })
  }

  const positions = {}
  const nodes = flowNodes.map((fn) => {
    const row = { ...(fn.data?.node || {}) }
    row.edges = bySource[fn.id] || []
    positions[fn.id] = { x: Math.round(fn.position?.x ?? 0), y: Math.round(fn.position?.y ?? 0) }
    return row
  })

  return { nodes, canvas: { positions, viewport: viewport || null } }
}

// Drop edges whose output the node no longer declares, or the backend validator rejects the save.
// `outputsByNode` MUST be freshly resolved for the current graph: this deletes the author's wiring, and
// pruning against a stale answer silently removes branches that are perfectly valid.
export function pruneInvalidEdges(flowNodes, flowEdges, outputsByNode) {
  const allowed = {}
  for (const fn of flowNodes) allowed[fn.id] = new Set(outputsByNode?.[fn.id] || [])
  return flowEdges.filter((e) => allowed[e.source]?.has(e.sourceHandle))
}
