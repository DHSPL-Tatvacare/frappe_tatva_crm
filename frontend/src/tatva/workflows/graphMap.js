// TATVA: pure mapping between the CRM Workflow graph and the Vue Flow canvas.
import dagre from '@dagrejs/dagre'

// Must match the card in WorkflowNode.vue. A node's height is a function of its OUTPUT COUNT — the default
// for a few, taller for a node whose outputs run down the right edge — so the layout can assume it.
const NODE_W = 260
const NODE_H = 112

// Above this many outputs, bottom handles would sit < ~30px apart across a 260px strip and become
// unreadable, so they move to the right edge, one per row. Keyed on the COUNT, never on the node_type: any
// many-output node inherits this, and a node-type branch here is the drift this project deletes.
const BOTTOM_MAX = 6
// Right-edge geometry: the first output row sits below the header strip, then one fixed row per output.
const RIGHT_HEADER_PX = 40
const RIGHT_ROW_PX = 24
const RIGHT_PAD_PX = 12

// Whether this node's outputs render on the right edge rather than spread along the bottom.
export function outputsOnRight(n) {
  return n > BOTTOM_MAX
}

// Even spread of bottom handles across the node width.
export function pct(i, n) {
  return n <= 1 ? 50 : Math.round(((i + 1) / (n + 1)) * 100)
}

// One output row's vertical centre on a right-edge node.
function rightTop(i) {
  return RIGHT_HEADER_PX + i * RIGHT_ROW_PX + RIGHT_ROW_PX / 2
}

// WHERE handle `i` of `n` renders — the position side and the inline style. WHICH handles exist is the
// backend's answer (`handlesForNode`); this only places them, and only by count (C17.1).
export function outputLayout(i, n) {
  if (!outputsOnRight(n))
    return { position: 'bottom', style: { left: `${pct(i, n)}%` } }
  return { position: 'right', style: { top: `${rightTop(i)}px` } }
}

// The style for the label that names handle `i` — under a bottom handle, or beside a right-edge one.
export function outputLabelStyle(i, n) {
  if (!outputsOnRight(n))
    return { left: `${pct(i, n)}%`, transform: 'translateX(-50%)' }
  return { top: `${rightTop(i)}px`, transform: 'translateY(-50%)' }
}

// A node's card height, DETERMINISTIC from its output count: null (the default) for a bottom node, and
// header + one row per output for a right-edge one — so every node of the same output count is the same
// size, by construction, and the auto-layout below can reserve the right room.
export function nodeOutputHeight(n) {
  return outputsOnRight(n)
    ? RIGHT_HEADER_PX + n * RIGHT_ROW_PX + RIGHT_PAD_PX
    : null
}

// Lay out any nodes that have no saved position, so a fresh graph never lands in a pile at 0,0.
function autoLayout(flowNodes, flowEdges, heights) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90 })
  g.setDefaultEdgeLabel(() => ({}))
  flowNodes.forEach((n) =>
    g.setNode(n.id, { width: NODE_W, height: heights?.[n.id] || NODE_H }),
  )
  flowEdges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  const out = {}
  flowNodes.forEach((n) => {
    const p = g.node(n.id)
    // dagre gives the node centre; Vue Flow positions by top-left.
    if (p)
      out[n.id] = {
        x: p.x - NODE_W / 2,
        y: p.y - (heights?.[n.id] || NODE_H) / 2,
      }
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
// {node_id: [output]} exactly as `registry.graph_outputs` returns it — WHICH handles exist is resolved
// there, never here. The only thing this adds is the DISPLAY text: a Route keys each handle on a stable
// generated row id, so the human LABEL for that id is looked up from the row it belongs to. The output
// itself is still the backend's; the label just decorates it, the same way the card summary reads config.
export function handlesForNode(node, outputsByNode) {
  const outputs = outputsByNode?.[node.node_id] || []
  if (outputs.length <= 1)
    return outputs.map((name) => ({ id: name, label: '' }))
  const labels = rowLabels(node)
  return outputs.map((name) => ({ id: name, label: labels[name] || name }))
}

// id → human label for a node whose outputs are its own labelled rows (Route). `otherwise` is reserved
// and always reads as itself. Keyed on the stable id so renaming a label never strands the wired edge.
function rowLabels(node) {
  const out = { otherwise: __('Otherwise') }
  for (const row of configOf(node).routes || []) {
    if (row && row.id) out[row.id] = row.label || row.id
  }
  return out
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
    // A right-edge node is taller; reserve its real height so the auto-layout does not overlap it.
    const heights = {}
    for (const n of nodeRows || [])
      heights[n.node_id] = nodeOutputHeight(
        (outputsByNode?.[n.node_id] || []).length,
      )
    const placed = autoLayout(flowNodes, flowEdges, heights)
    missing.forEach((n) => {
      n.position = placed[n.id] || { x: 0, y: 0 }
    })
  }
  return { flowNodes, flowEdges }
}

// The node rows as the canvas holds them RIGHT NOW: `data.node.edges` is the wiring the graph was LOADED with and nothing writes it again, so every authoring answer that walks edges to decide POSITION (a Wait's `Waiting on` and `Outcome`, and the value picker with them) went blind the moment an author drew one. ONE merge, used by the question and by the save alike, so the graph the backend judges and the graph that gets stored are never two graphs.
// TATVA: the identity of the QUESTION `registry.graph_outputs` answers — every node's id, type and config,
// and deliberately NOT its edges: an output is what a node can emit, and where that output goes is a
// different question the endpoint never reads (registry.py:1038-1043). Two callers hand it the same graph
// in two shapes — the loaded rows, and the same rows merged with live edges — so a raw stringify saw two
// different payloads for one question and asked it twice on every load, and again on every edge drag.
export function outputsQueryKey(rows) {
  return JSON.stringify(
    (rows || [])
      .map((n) => [
        n.node_id,
        n.node_type,
        n.config_json ?? JSON.stringify(n.config ?? {}),
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  )
}

export function withLiveEdges(flowNodes, flowEdges) {
  const bySource = {}
  for (const e of flowEdges || []) {
    if (!e.sourceHandle) continue
    ;(bySource[e.source] = bySource[e.source] || []).push({
      from_output: e.sourceHandle,
      to_node: e.target,
    })
  }
  return (flowNodes || []).map((fn) => ({
    ...(fn.data?.node || {}),
    edges: bySource[fn.id] || [],
  }))
}

// Vue Flow live state → { nodes: rows, canvas: {positions, viewport} }.
export function flowToDefinition(flowNodes, flowEdges, viewport) {
  const positions = {}
  for (const fn of flowNodes) {
    positions[fn.id] = {
      x: Math.round(fn.position?.x ?? 0),
      y: Math.round(fn.position?.y ?? 0),
    }
  }
  return {
    nodes: withLiveEdges(flowNodes, flowEdges),
    canvas: { positions, viewport: viewport || null },
  }
}

// Drop edges whose output the node no longer declares, or the backend validator rejects the save.
// `outputsByNode` MUST be freshly resolved for the current graph: this deletes the author's wiring, and
// pruning against a stale answer silently removes branches that are perfectly valid.
export function pruneInvalidEdges(flowNodes, flowEdges, outputsByNode) {
  const allowed = {}
  for (const fn of flowNodes)
    allowed[fn.id] = new Set(outputsByNode?.[fn.id] || [])
  return flowEdges.filter((e) => allowed[e.source]?.has(e.sourceHandle))
}
