// TATVA: pure mapping between the CRM Workflow graph and the Vue Flow canvas.
import dagre from '@dagrejs/dagre'

// Must match the card in WorkflowNode.vue. A node's height is a function of its OUTPUT COUNT — the default for a few, taller for a node whose outputs run down the right edge — so the layout can assume it.
export const NODE_W = 260
export const NODE_H = 112

// Above this many outputs, bottom handles would sit < ~30px apart across a 260px strip and become unreadable, so they move to the right edge, one per row. Keyed on the COUNT, never on the node_type: any many-output node inherits this, and a node-type branch here is the drift this project deletes. DECIDED 2026-08-13 — 4, not 6: a 5-output Route fired every branch downward, so a target moved to the right could only be reached by crossing the other four, and an edge shape alone would tidy the line and leave the crossing.
const BOTTOM_MAX = 4
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

// WHERE handle `i` of `n` renders — the position side and the inline style. WHICH handles exist is the backend's answer (`handlesForNode`); this only places them, and only by count (C17.1).
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

// A node's card height, DETERMINISTIC from its output count: null (the default) for a bottom node, and header + one row per output for a right-edge one — so every node of the same output count is the same size, by construction, and the auto-layout below can reserve the right room.
export function nodeOutputHeight(n) {
  return outputsOnRight(n)
    ? RIGHT_HEADER_PX + n * RIGHT_ROW_PX + RIGHT_PAD_PX
    : null
}

// The lines that point back up the flow: a walk down from the nodes nothing enters meets each one as a step to a node still on its path.
export function loopEdges(flowNodes, flowEdges) {
  const out = new Map()
  flowEdges.forEach((e) => out.set(e.source, [...(out.get(e.source) || []), e]))
  const entered = new Set(flowEdges.map((e) => e.target))
  const state = {}
  const loops = new Set()
  const walk = (id) => {
    state[id] = 'open'
    for (const e of out.get(id) || []) {
      if (state[e.target] === 'open') loops.add(e.id)
      else if (!state[e.target]) walk(e.target)
    }
    state[id] = 'done'
  }
  const roots = flowNodes.filter((n) => !entered.has(n.id))
  ;[...roots, ...flowNodes].forEach((n) => state[n.id] || walk(n.id))
  return loops
}

// dagre's top-to-bottom layout on the forward lines only, so a loop never bends the main path: a fresh graph's unplaced nodes, and the canvas's Tidy up for every node.
export function autoLayout(flowNodes, flowEdges, heights) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90 })
  g.setDefaultEdgeLabel(() => ({}))
  flowNodes.forEach((n) =>
    g.setNode(n.id, { width: NODE_W, height: heights?.[n.id] || NODE_H }),
  )
  const loops = loopEdges(flowNodes, flowEdges)
  flowEdges.forEach((e) => loops.has(e.id) || g.setEdge(e.source, e.target))
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

// The key the canvas provides its lane plan under, and every line reads it from.
export const LANES = Symbol('workflow-lanes')

// Lanes: the gap a lane keeps from the cards beside it, the space between two lanes, the drop a line makes before it turns, and the corner radius.
const LANE_GAP = 36
const LANE_STEP = 14
export const LANE_STUB = 24
const CORNER = 8

// A card as a rectangle, from Vue Flow's live node.
function rectOf(n) {
  const { x, y } = n.computedPosition
  return { id: n.id, x, y, w: n.dimensions?.width || NODE_W, h: n.dimensions?.height || NODE_H }
}

// Where a line meets a card: the handle's centre and side, or the card's bottom (source) or top (target) centre before handles are measured.
function handlePoint(n, kind, id) {
  const r = rectOf(n)
  const h = (n.handleBounds?.[kind] || []).find((b) => kind === 'target' || (b.id ?? null) === (id ?? null))
  if (!h) return { x: r.x + r.w / 2, y: kind === 'source' ? r.y + r.h : r.y, position: kind === 'source' ? 'bottom' : 'top' }
  return { x: r.x + h.x + h.width / 2, y: r.y + h.y + h.height / 2, position: h.position }
}

const crossesV = (r, x, y1, y2) => x > r.x && x < r.x + r.w && Math.max(y1, y2) > r.y && Math.min(y1, y2) < r.y + r.h
const crossesH = (r, y, x1, x2) => y > r.y && y < r.y + r.h && Math.max(x1, x2) > r.x && Math.min(x1, x2) < r.x + r.w

// Whether Vue Flow's own smoothstep line from s to t would run through another card.
function blocked(s, t, others) {
  if (s.position === 'right') return others.some((r) => crossesH(r, s.y, s.x, t.x) || crossesV(r, t.x, s.y, t.y))
  const mid = (s.y + t.y) / 2
  return others.some((r) => crossesV(r, s.x, s.y, mid) || crossesH(r, mid, s.x, t.x) || crossesV(r, t.x, mid, t.y))
}

// Every line that cannot be a plain smoothstep, as {side, x}: a loop takes a lane on its own side, a forward line a card would cut takes one on the right; lanes whose spans overlap step outwards.
export function planLanes(graphNodes, graphEdges) {
  const byId = new Map(graphNodes.map((n) => [n.id, n]))
  const rects = graphNodes.map(rectOf)
  const routed = []
  for (const e of graphEdges) {
    const sn = byId.get(e.source)
    const tn = byId.get(e.target)
    if (!sn || !tn) continue
    const s = handlePoint(sn, 'source', e.sourceHandle)
    const t = handlePoint(tn, 'target')
    const loop = t.y < s.y + LANE_STUB
    if (!loop && !blocked(s, t, rects.filter((r) => r.id !== e.source && r.id !== e.target))) continue
    // A loop runs up the left, unless its card sits right of its target or its output is on the right edge: then the right, so it never crosses the main path.
    const side = loop && s.position !== 'right' && rectOf(sn).x <= rectOf(tn).x ? 'left' : 'right'
    const top = Math.min(s.y, t.y) - LANE_STUB
    const bottom = Math.max(s.y, t.y) + LANE_STUB
    const beside = rects.filter((r) => r.y < bottom && r.y + r.h > top)
    const edge = side === 'left' ? Math.min(...beside.map((r) => r.x)) : Math.max(...beside.map((r) => r.x + r.w))
    routed.push({ id: e.id, side, top, bottom, edge })
  }
  // Shortest spans take the inner lanes, so a short loop never wraps around a long one.
  routed.sort((a, b) => a.bottom - a.top - (b.bottom - b.top) || a.id.localeCompare(b.id))
  const lanes = new Map()
  const placed = []
  for (const r of routed) {
    const taken = new Set(placed.filter((p) => p.side === r.side && p.top < r.bottom && p.bottom > r.top).map((p) => p.lane))
    let lane = 0
    while (taken.has(lane)) lane++
    placed.push({ ...r, lane })
    const offset = LANE_GAP + lane * LANE_STEP
    lanes.set(r.id, { side: r.side, x: r.side === 'left' ? r.edge - offset : r.edge + offset })
  }
  return lanes
}

// A lane line's corners: out of the source, along the lane at x, then down into the target's top.
export function lanePoints(s, sourcePosition, t, x) {
  const enter = t.y - LANE_STUB
  const out = sourcePosition === 'right' ? [s, { x, y: s.y }] : [s, { x: s.x, y: s.y + LANE_STUB }, { x, y: s.y + LANE_STUB }]
  return [...out, { x, y: enter }, { x: t.x, y: enter }, t]
}

// An orthogonal polyline as an SVG path with rounded corners; repeated points are dropped first.
export function roundedPath(points, radius = CORNER) {
  const pts = points.filter((p, i) => !i || p.x !== points[i - 1].x || p.y !== points[i - 1].y)
  const toward = (a, b, d) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len }
  }
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]]
    const r = Math.min(radius, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2)
    const p1 = toward(b, a, r)
    const p2 = toward(b, c, r)
    d += ` L${p1.x},${p1.y} Q${b.x},${b.y} ${p2.x},${p2.y}`
  }
  const last = pts[pts.length - 1]
  return `${d} L${last.x},${last.y}`
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

// The output handles this node draws, from the backend's resolved answer. `outputsByNode` is {node_id: [output]} exactly as `registry.graph_outputs` returns it — WHICH handles exist is resolved there, never here. The only thing this adds is the DISPLAY text: a Route keys each handle on a stable generated row id, so the human LABEL for that id is looked up from the row it belongs to. The output itself is still the backend's; the label just decorates it, the same way the card summary reads config.
export function handlesForNode(node, outputsByNode) {
  const outputs = outputsByNode?.[node.node_id] || []
  if (outputs.length <= 1)
    return outputs.map((name) => ({ id: name, label: '' }))
  const labels = rowLabels(node)
  return outputs.map((name) => ({ id: name, label: labels[name] || name }))
}

// id → human label for a node whose outputs are its own labelled rows (Route). `otherwise` is reserved and always reads as itself. Keyed on the stable id so renaming a label never strands the wired edge.
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
    for (const edge of n.edges || []) {
      if (!edge.to_node) continue
      flowEdges.push({
        id: `${n.node_id}__${edge.from_output}`,
        // The shape is DECLARED, not inherited: with no `type` every branch of a many-output Route swept diagonally across its siblings. `workflow` is WorkflowEdge.vue: Vue Flow's own smoothstep path with an X to disconnect; the canvas's default-edge-options gives drawn lines the same type.
        type: 'workflow',
        source: n.node_id,
        sourceHandle: edge.from_output,
        target: edge.to_node,
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

// The settings of ONE node the server's answer can move with, read off its declaration (`shapes_outputs`, a declared vocabulary, or a structured value); typed text never changes a graph's meaning.
function meaningfulConfig(node, declarationFor) {
  const config = node.config_json != null ? configOf(node) : node.config || {}
  const declared = declarationFor && declarationFor(node.node_type)
  if (!declared) return config
  const meant = {}
  for (const field of declared.config || []) {
    if (field.shapes_outputs || field.options?.length || !field.primitive)
      meant[field.name] = config[field.name] ?? null
  }
  return meant
}

// TATVA: the identity of the ONE QUESTION the server answers about a graph — what may leave each node, and what each node may reference. Both derive from ids, types, wiring and the settings above, so THAT is the key. The old key hashed every character of every config, which made each keystroke a distinct question by construction: 24 characters typed into a Subject fetched the same answer 25 times. Two callers hand the graph over in two shapes — the loaded rows, and the same rows merged with live edges — and both normalise to one key here, or one load asked the same question twice.
export function meaningKey(rows, declarationFor) {
  return JSON.stringify(
    (rows || [])
      .map((n) => [
        n.node_id,
        n.node_type,
        meaningfulConfig(n, declarationFor),
        (n.edges || [])
          .filter((e) => e && e.from_output && e.to_node)
          .map((e) => [e.from_output, e.to_node])
          .sort((a, b) => String(a).localeCompare(String(b))),
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  )
}

// The node rows as the canvas holds them now, wired off the live edges: ONE merge for the server's question and the save alike.
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
    ...fn.data?.node,
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

// Drop edges whose output the node no longer declares, or the backend validator rejects the save. `outputsByNode` MUST be freshly resolved for the current graph: this deletes the author's wiring, and pruning against a stale answer silently removes branches that are perfectly valid.
export function pruneInvalidEdges(flowNodes, flowEdges, outputsByNode) {
  const allowed = {}
  for (const fn of flowNodes)
    allowed[fn.id] = new Set(outputsByNode?.[fn.id] || [])
  return flowEdges.filter((e) => allowed[e.source]?.has(e.sourceHandle))
}
