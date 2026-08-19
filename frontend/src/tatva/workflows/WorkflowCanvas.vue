<!-- TATVA: the orchestration editor. -->
<template>
  <div class="flex h-full w-full">
    <NodePalette
      v-if="editable && nodeTypesReady && !isMobileView"
      :present="presentTypes"
    />

    <!-- min-w-0 or the canvas cannot shrink below its content and the page scrolls sideways. -->
    <div class="relative min-w-0 flex-1" @drop="onDrop">
      <!-- Shift is BOTH the multi-select and the lasso key, so one modifier does the whole selection story, and it is UNCHANGED — the tool bar only flips `pan-on-drag`, which is what decides whether a plain drag pans or lassoes. `selection-key-code` is left at its own default, which is already Shift and whose runtime prop type refuses a string. Snap-to-grid is OFF by owner decision: a node follows the pointer exactly, and align/distribute are the tidy-up. -->
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :nodes-draggable="editable && nodeTypesReady"
        :nodes-connectable="editable && nodeTypesReady"
        :delete-key-code="null"
        :elements-selectable="true"
        :multi-selection-key-code="'Shift'"
        :selection-mode="SelectionMode.Partial"
        :pan-on-drag="panOnDrag"
        :connection-line-type="'smoothstep'"
        :min-zoom="0.2"
        :max-zoom="2"
        :fit-view-on-init="!startViewport"
        @dragover="onDragOver"
      >
        <Background pattern-color="var(--outline-gray-2)" :gap="16" />
        <Controls />
        <MiniMap pannable zoomable />

        <!-- The selection story rode one modifier, which is a keyboard secret on a pointer surface. These are the SAME two behaviours, named: `bottom-left` is Controls, `bottom-right` is the MiniMap and the right is the inspector, so `top-left` is the free anchor. -->
        <Panel
          position="top-left"
          class="flex gap-1 rounded-md border border-outline-gray-2 bg-surface-white p-1 shadow-sm"
        >
          <Button
            v-for="tool in TOOLS"
            :key="tool.label"
            :variant="panOnDrag === tool.pans ? 'subtle' : 'ghost'"
            :label="__(tool.label)"
            :tooltip="__(tool.tooltip)"
            @click="panOnDrag = tool.pans"
          />
        </Panel>

        <!-- Align floats over the canvas instead of taking the sidebar: the panel that opened BECAUSE a second node was selected was also what covered the third one the author was reaching for. -->
        <Panel
          v-if="alignPanel"
          position="top-center"
          class="flex items-center gap-3 rounded-md border border-outline-gray-2 bg-surface-white px-3 py-2 shadow-sm"
        >
          <span class="whitespace-nowrap text-xs text-ink-gray-5">
            {{ __('{0} nodes selected', [selectionCount]) }}
          </span>
          <div class="flex gap-1">
            <Button
              v-for="how in ALIGNMENTS"
              :key="how.name"
              :label="__(how.label)"
              @click="alignSelection(how.name)"
            />
          </div>
          <div class="flex gap-1">
            <Button
              :label="__('Across')"
              :disabled="selectionCount < 3"
              @click="distributeSelection('x')"
            />
            <Button
              :label="__('Down')"
              :disabled="selectionCount < 3"
              @click="distributeSelection('y')"
            />
          </div>
        </Panel>

        <template #node-workflow="nodeProps">
          <WorkflowNode
            v-bind="nodeProps"
            :outputs="outputsByNode[nodeProps.id] || []"
            :live="activeNodes[nodeProps.id] || ''"
            :problems="problemsByNode[nodeProps.id] || []"
            :waiting="counts.data?.waiting?.[nodeProps.id] || 0"
            :failed="counts.data?.failed?.[nodeProps.id] || 0"
            :spotlit="spotlitId === nodeProps.id"
          />
        </template>
      </VueFlow>
    </div>

    <!-- The CRM's own side-panel resizer (pages/Lead.vue, Deal, Contact, Organization): it owns the drag, the snap-to-default, the min/max clamp and the select-none handling. It does not restore a width — no caller does — so the one thing it lacks is supplied here, at the call site, rather than by forking it. -->
    <Resizer
      v-if="selectedNode"
      side="right"
      class="hidden sm:block"
      :defaultWidth="inspectorWidth"
      :minWidth="INSPECTOR_MIN"
      :maxWidth="INSPECTOR_MAX"
      @update:sidebarWidth="(w) => (inspectorWidth = w)"
    >
      <!-- ONE right panel with ONE job: the inspector edits ONE node. A multi-selection gets the align tools out on the canvas instead, so this can never silently edit whichever node was clicked last. -->
      <NodeInspector
        :key="selectedId"
        class="h-full"
        :node="selectedNode.data.node"
        :editable="editable"
        :context="selectedContext"
        :problems="problemsByNode[selectedId] || []"
        @close="selectedId = null"
        @update:config="applyConfig"
        @shape-change="pruneEdges"
        @delete="removeNode"
        @spotlight="(id) => (spotlitId = id)"
      />
    </Resizer>
  </div>
</template>
<script setup>
import { VueFlow, useVueFlow, SelectionMode, Panel } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { ref, computed, watch, onMounted, onBeforeUnmount, provide } from 'vue'
import { Button, createResource, debounce } from 'frappe-ui'
import { useStorage, watchOnce } from '@vueuse/core'
import Resizer from '@/components/Resizer.vue'
import { isMobileView } from '@/composables/settings'
import WorkflowNode from './WorkflowNode.vue'
import NodePalette from './NodePalette.vue'
import NodeInspector from './NodeInspector.vue'
import {
  definitionToFlow,
  flowToDefinition,
  pruneInvalidEdges,
  latestOnly,
  withLiveEdges,
  meaningKey,
} from './graphMap'
import { contextFor } from './nodeContext'
import { useNodeTypes } from '@/tatva/useNodeTypes'
import { useLiveSteps } from './liveSteps'
import { docLinkTitles } from '@/tatva/linkTitle'

const props = defineProps({
  definition: { type: Object, required: true }, // the loaded CRM Workflow doc, with its nodes attached
  editable: { type: Boolean, default: false },
  // Publish faults as {node_id, field, message} — the canvas marks the nodes they name.
  problems: { type: Array, default: () => [] },
})

// Live step progress: the engine publishes each executed node to this workflow's doc room.
const { activeNodes } = useLiveSteps(computed(() => props.definition?.name))

// The graph's Link titles, loaded WITH the workflow (`workflows.api.get_workflow`) and provided the way
// every other document surface provides them — `FieldLayout` and `TaskModal` do exactly this, and
// `Controls/Link.vue` reads it by the same inject. Without it each card asked the framework's link search
// for itself: ten parallel requests on opening one Anaya flow.
provide(
  'linkTitles',
  computed(() => docLinkTitles(props.definition)),
)

// Journeys resting on each node, for the version on screen. A never-published workflow has no version and
// therefore nothing to count, so the request is not made at all.
const counts = createResource({
  url: 'tatva_connect.workflow_engine.history.node_counts',
  makeParams: () => ({
    workflow: props.definition?.name,
    workflow_version: props.definition?.version?.name,
  }),
})

watch(
  () => props.definition?.version?.name,
  (version) => version && counts.fetch(),
  { immediate: true },
)

function parseCanvas() {
  try {
    return props.definition.canvas_json
      ? JSON.parse(props.definition.canvas_json)
      : {}
  } catch {
    return {}
  }
}
// Re-read on every rebuild, never snapshotted: a save answers with the canvas_json it just stored, and a positions map captured at setup would put the graph back where it was before the author moved it.
const startViewport = parseCanvas().viewport || null

const { nodeTypesReady, declarationFor } = useNodeTypes()

const nodes = ref([])
const edges = ref([])
const selectedId = ref(null)

// The node whose output the author is pointing at, from the inspector below it. Transient hover state
// belonging to this one screen — a store would outlive the canvas for no reader (F8).
const spotlitId = ref(null)

// F8 again: the inspector's width is local to this canvas and lives HERE because `:key="selectedId"` remounts the panel on every node click.
// 384 measured, not guessed: a predicate row is `flex-wrap`, so at this width it takes a third line and the value box renders WIDER (289px) than it did at 480 (217px) — the sliver this floor was raised to prevent is prevented by the wrap, not by the width. The ceiling keeps the graph on screen.
const INSPECTOR_MIN = 384
// Breathing room so a node the inspector nudged into view does not sit flush against the panel edge.
const VIEWPORT_MARGIN = 24
const INSPECTOR_MAX = 512
// §8 keys per-RECORD state by record, and a panel width is not a fact about a workflow but about the author's screen — so ONE global key, because a key per workflow would recreate the very defect being fixed (a preference re-entered on every workflow is not a preference).
// The key carries the default's generation: `useStorage` seeds it with the floor on first use, so an author
// who never dragged has the OLD default stored and is indistinguishable from one who chose it. Bumping the
// key is how a changed default reaches them — a stored width is only a preference once it has been dragged.
const inspectorWidth = useStorage(
  'tatva:workflow-inspector-width:384',
  INSPECTOR_MIN,
)
// A width remembered from outside the current bounds would keep the old panel for ever.
inspectorWidth.value = Math.min(Math.max(inspectorWidth.value, INSPECTOR_MIN), INSPECTOR_MAX)
// A closing panel takes its spotlight with it. Unmounting fires no `mouseleave`, so a node under the
// pointer at the moment the author clicked the pane would keep its ring with nothing left to clear it.
watch(selectedId, () => (spotlitId.value = null))

// C17.1 — what can leave a node and what a node may reference are the backend's answer, not ours, and they
// are ONE answer about ONE graph: both were derived from this exact node list, and there is no moment in
// the editor that wants one without the other. A Wait's handles are a fact about the node it waits ON, so
// the question only has an answer for a whole graph; the JS twin that used to compute it here rendered
// zero nodes for a day, and the panel it feeds is a `:key` destroys on every click.
const graphContext = createResource({
  url: 'tatva_connect.workflow_engine.context.graph_context',
})
const outputsByNode = ref({})
const authoringAnswer = ref(null)

// Sequenced, because `pruneEdges` deletes from this: a stale answer landing late would drop live branches.
const fetchGraphContext = latestOnly((rows) =>
  graphContext.fetch({ nodes: JSON.stringify(rows) }),
)

// Resolved for the rows GIVEN, never for whatever `nodes` happens to hold: the first call runs before the
// canvas is built, and `pruneEdges` needs the answer for the config the author just changed.
// Asked once per MEANING, not once per keystroke: the key is the registry's own declaration of what this
// answer varies by, so 24 characters typed into a Subject are not 24 new questions.
// The debounce below outlives the component by up to its own wait, so a canvas closed mid-edit would still
// ask the server for a graph nobody is looking at — answered here, where both the timer and every direct
// caller pass, rather than at one call site.
let alive = true
let askedFor = ''
async function resolveGraphContext(rows) {
  if (!alive) return outputsByNode.value
  const asking = meaningKey(rows, declarationFor)
  if (asking === askedFor) return outputsByNode.value
  askedFor = asking
  const answer = (await fetchGraphContext(rows)) || {}
  outputsByNode.value = answer.outputs || {}
  authoringAnswer.value = answer.context || null
  return outputsByNode.value
}

// A Route row's LABEL is free text and IS part of the meaning, so the one resolver keeps one debounce.
const resolveGraphContextSoon = debounce(resolveGraphContext, 300)

// The DOCUMENT owns the graph and this renders it: a rebuild follows the definition's identity, which
// changes only when the document is refetched — never on a local edit, or Discard would have nothing left
// to discard. Guarded on `nodeTypesReady` because the registry arrives asynchronously and the mapping
// needs it. Saving is a checkpoint, not a decision to stop working, so the node being edited keeps its
// selection and its panel across the rebuild.
watch(
  [nodeTypesReady, () => props.definition],
  async ([ready]) => {
    if (!ready) return
    const rows = props.definition.nodes || []
    const built = definitionToFlow(
      rows,
      parseCanvas(),
      await resolveGraphContext(rows),
    )
    const kept = built.flowNodes.find((n) => n.id === selectedId.value)
    if (kept) kept.selected = true
    else selectedId.value = null
    nodes.value = built.flowNodes
    edges.value = built.flowEdges
  },
  { immediate: true },
)
// The inspector needs the whole graph, and the WIRING is what answers it — so it comes off the live edge list through the SAME merge the save uses; `n.data.node` alone carries the wiring this canvas was loaded with.
const graphNodes = computed(() => withLiveEdges(nodes.value, edges.value))

// Handles follow the wiring without a reload: a button added to a send changes what leaves the Wait below it, and that is a different graph, so it is a different answer.
// Watched on the MEANING rather than on a stringify of the whole graph, so a keystroke that cannot move the answer never reaches the resolver at all — and the one key is computed once per change instead of the graph being stringified twice.
watch(
  () => meaningKey(graphNodes.value, declarationFor),
  () => {
    if (!graphNodes.value.length) return
    resolveGraphContextSoon(graphNodes.value)
  },
)

// Selecting a node is a LOOKUP — nothing is fetched, so the panel opens with its labels already resolved.
const selectedContext = computed(() =>
  contextFor(authoringAnswer.value, selectedId.value),
)
// Which types are already placed, so the palette can disable a singleton the workflow already owns.
const presentTypes = computed(() => graphNodes.value.map((n) => n.node_type))

// Faults grouped by the node they belong to; graph-level faults carry no node and are not shown here.
const problemsByNode = computed(() => {
  const byNode = {}
  for (const p of props.problems) {
    if (p.node_id) (byNode[p.node_id] ||= []).push(p)
  }
  return byNode
})
const {
  onConnect,
  onInit,
  onNodeClick,
  onNodeDragStop,
  onPaneClick,
  getViewport,
  setViewport,
  setNodes,
  getSelectedNodes,
  screenToFlowCoordinate,
  toObject,
  findNode,
  vueFlowRef,
  flowToScreenCoordinate,
  fitView,
  dimensions,
} = useVueFlow()

// Vue Flow already owns the selection SET; `selectedId` is only the node clicked LAST, which is the one the inspector edits — a second set held here would be a rival answer to a question the library already answers.
const selectionCount = computed(() => getSelectedNodes.value.length)
// A multi-selection must never silently edit one node, so the inspector stands down and the align tools take the panel — never both, and never neither.
const selectedNode = computed(() =>
  selectionCount.value > 1
    ? null
    : nodes.value.find((n) => n.id === selectedId.value) || null,
)
const alignPanel = computed(
  () => props.editable && selectionCount.value > 1 && !isMobileView.value,
)

// A STRING, not an array: `selectedNode` recomputes off `nodes`, which Vue Flow mutates every drag frame, so an array source would be a new identity each frame; folded, it changes only when the palette or the inspector really moves the pane's edge.
const paneChrome = computed(() => `${props.editable}|${!!selectedNode.value}`)
// The palette and inspector are LAYOUT, not overlay — together they took the canvas from 1421px to 701 and left three of seven nodes unreachable past the right edge, so the pane re-fits through the library's own `fitView` once its observer has measured the new width.
watch(paneChrome, () =>
  watchOnce(() => dimensions.value.width, () => fitView({ padding: 0.2, duration: 200 })),
)

// Which of the two behaviours a plain drag has, by the prop the core already exposes: `true` pans (today's default), `false` lets Vue Flow draw its own lasso. Shift is untouched and still does both.
const TOOLS = [
  { label: 'Pan', tooltip: 'Drag to move the canvas', pans: true },
  { label: 'Select', tooltip: 'Drag to lasso nodes', pans: false },
]
const panOnDrag = ref(true)

// Losing width means losing view, which is true of every canvas; the ONLY thing that must survive the inspector opening is the node it opened to edit. Panning by the panel's full width instead traded nodes hidden on the right for nodes hidden on the left, one for one — measured 0 of 7 nodes off-canvas before, 5 of 7 after.
// Keyed on the SELECTION as well as the width: keyed on width alone it never fired when the author picked a second node while the panel was already open, which is the case it exists for.
watch(
  () => [selectedId.value, selectedNode.value ? inspectorWidth.value : 0],
  ([, now]) => {
    if (!now || !selectedNode.value) return
    const node = findNode(selectedId.value)
    const pane = vueFlowRef.value?.getBoundingClientRect()
    if (!node || !pane) return
    // The library owns the flow -> screen transform; only the DECISION is ours, because no native helper moves the viewport ONLY when it has to.
    const left = flowToScreenCoordinate({ x: node.position.x, y: node.position.y })
    const right = flowToScreenCoordinate({
      x: node.position.x + (node.dimensions?.width || 0),
      y: node.position.y,
    })
    // `pane` is measured AFTER the panel took its width, so it already excludes it; subtracting the width again overshot by the width itself.
    const past = right.x - (pane.right - VIEWPORT_MARGIN)
    const short = pane.left + VIEWPORT_MARGIN - left.x
    const shift = past > 0 ? -past : short > 0 ? short : 0
    if (!shift) return
    const vp = getViewport()
    setViewport({ x: vp.x + shift, y: vp.y, zoom: vp.zoom })
  },
)

// The node's settings, applied by the OWNER of the node list. The inspector used to assign straight into
// `props.node`, which is the same object this canvas holds, so a child was writing the parent's state.
function applyConfig(configJson) {
  const found = nodes.value.find((n) => n.id === selectedId.value)
  if (found) found.data.node = { ...found.data.node, config_json: configJson }
}

// WHAT the graph says: ids, types, settings and wiring. Positions are deliberately absent, so dragging a
// node never reads as a change of meaning — the same split the evals-platform builder settled on.
const contentSignature = computed(() =>
  JSON.stringify({
    nodes: nodes.value.map((n) => [
      n.id,
      n.data.node.node_type,
      n.data.node.config_json,
    ]),
    edges: edges.value.map((e) => [e.source, e.sourceHandle, e.target]).sort(),
  }),
)

// WHERE it sits. Vue Flow mutates `position` internally during a drag, so this counts completed drags via
// its own event instead of polling for pixels — one tick per drag, not one per frame.
const layoutVersion = ref(0)
onNodeDragStop(() => layoutVersion.value++)

const committed = ref(null)

// Unsaved work is a comparison, not a flag something has to remember to set. Nothing polls it.
const dirty = computed(() => {
  if (!props.editable || committed.value === null) return false
  return (
    committed.value.content !== contentSignature.value ||
    committed.value.layout !== layoutVersion.value
  )
})

function markClean() {
  committed.value = {
    content: contentSignature.value,
    layout: layoutVersion.value,
  }
}

onInit(() => {
  if (startViewport) setViewport(startViewport)
})

onNodeClick(({ node }) => (selectedId.value = node.id))
onPaneClick(() => (selectedId.value = null))

// One edge per (source, sourceHandle): a re-connect replaces the old target.
onConnect((params) => {
  if (!props.editable) return
  edges.value = edges.value
    .filter(
      (e) =>
        !(e.source === params.source && e.sourceHandle === params.sourceHandle),
    )
    .concat({
      id: `${params.source}__${params.sourceHandle}`,
      source: params.source,
      sourceHandle: params.sourceHandle,
      target: params.target,
    })
})

// dragover must preventDefault on the pane, or the browser never fires drop.
function onDragOver(event) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

// Drag a palette tile onto the canvas → add a node at the drop point.
function onDrop(event) {
  if (!props.editable) return
  const type = event.dataTransfer.getData('application/workflow-node')
  if (!type) return
  const position = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  })
  const id = newNodeId(type)
  // Born with empty settings: what a type takes is the registry's to declare and the inspector's to ask for.
  const nodeRow = { node_id: id, node_type: type, config_json: '{}', edges: [] }
  nodes.value.push({ id, type: 'workflow', position, data: { node: nodeRow } })
  selectedId.value = id
}

// A node id is not a label: it goes into edges, into the correlation token a raised task carries
// (`journey::node`), and into the problems the canvas anchors. Spaces there are a liability, so a type like
// "Update Field" becomes `update-field-1`, not `update field-1`.
function newNodeId(type) {
  const base = type
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const existing = new Set(nodes.value.map((n) => n.id))
  let i = 1
  while (existing.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

// The six alignments, declared once so the panel renders from a list rather than six near-identical buttons.
const ALIGNMENTS = [
  { name: 'left', label: 'Left' },
  { name: 'centre', label: 'Centre' },
  { name: 'right', label: 'Right' },
  { name: 'top', label: 'Top' },
  { name: 'middle', label: 'Middle' },
  { name: 'bottom', label: 'Bottom' },
]
// Which axis each alignment moves. The other axis is left exactly where the author put it.
const ALIGN_AXIS = {
  left: 'x',
  centre: 'x',
  right: 'x',
  top: 'y',
  middle: 'y',
  bottom: 'y',
}

// One write for every move: Vue Flow's own `setNodes`, so the store stays the owner and `v-model:nodes` syncs the new positions back; a completed move is unsaved work, exactly as a completed drag is.
function moveNodes(positionById, axis) {
  setNodes((all) =>
    all.map((n) =>
      n.id in positionById
        ? {
            ...n,
            position: { ...n.position, [axis]: Math.round(positionById[n.id]) },
          }
        : n,
    ),
  )
  layoutVersion.value++
}

// Line the selection up, measured on the real card box (`dimensions`) so centre and right stay true for a tall many-output node; a node the browser has not measured yet contributes a width of 0 and still aligns.
function alignSelection(how) {
  const picked = getSelectedNodes.value
  if (!props.editable || picked.length < 2) return
  const axis = ALIGN_AXIS[how]
  const side = axis === 'x' ? 'width' : 'height'
  const lengthOf = (n) => n.dimensions?.[side] || 0
  const min = Math.min(...picked.map((n) => n.position[axis]))
  const max = Math.max(...picked.map((n) => n.position[axis] + lengthOf(n)))
  const moved = {}
  for (const n of picked) {
    if (how === 'left' || how === 'top') moved[n.id] = min
    else if (how === 'right' || how === 'bottom')
      moved[n.id] = max - lengthOf(n)
    else moved[n.id] = (min + max) / 2 - lengthOf(n) / 2
  }
  moveNodes(moved, axis)
}

// Even the gaps out: the two ends stay where the author already put them and everything between is spaced equally, which is why it takes three nodes to mean anything.
function distributeSelection(axis) {
  const picked = getSelectedNodes.value
  if (!props.editable || picked.length < 3) return
  const side = axis === 'x' ? 'width' : 'height'
  const ordered = [...picked].sort(
    (a, b) => a.position[axis] - b.position[axis],
  )
  const first = ordered[0].position[axis]
  const last = ordered[ordered.length - 1].position[axis]
  // The GAPS are evened, not the positions: a node's height is a function of its output count (graphMap
  // NODE_H), so equal positions leave visibly unequal gaps down a column of mixed nodes.
  const between = ordered
    .slice(0, -1)
    .reduce((sum, n) => sum + (n.dimensions?.[side] || 0), 0)
  const gap = (last - first - between) / (ordered.length - 1)
  const moved = {}
  let cursor = first
  for (const n of ordered) {
    moved[n.id] = cursor
    cursor += (n.dimensions?.[side] || 0) + gap
  }
  moveNodes(moved, axis)
}

// A copied node is its TYPE and its SETTINGS. Nothing else survives, because everything else names a node.
const clipboard = ref([])
// Far enough that the copy is visibly its own box, and not on top of the node it came from.
const PASTE_OFFSET = 48

function copySelection() {
  if (!props.editable || !getSelectedNodes.value.length) return
  clipboard.value = getSelectedNodes.value.map((n) => ({
    node: n.data.node,
    position: { ...n.position },
  }))
}

// Edges are deliberately NOT copied: an edge names a node and the paste is a different node, so carrying one would either duplicate a branch or point at the original; a singleton the workflow already owns is skipped for the same reason the palette disables it.
function pasteClipboard() {
  if (!props.editable || !clipboard.value.length) return
  let landed = null
  for (const copied of clipboard.value) {
    if (
      declarationFor(copied.node.node_type)?.singleton &&
      presentTypes.value.includes(copied.node.node_type)
    )
      continue
    const id = newNodeId(copied.node.node_type)
    nodes.value.push({
      id,
      type: 'workflow',
      position: {
        x: copied.position.x + PASTE_OFFSET,
        y: copied.position.y + PASTE_OFFSET,
      },
      data: {
        node: {
          node_id: id,
          node_type: copied.node.node_type,
          config_json: copied.node.config_json || '{}',
          edges: [],
        },
      },
    })
    landed = id
  }
  if (landed) selectedId.value = landed
}

// The shortcuts every editor has, ignored inside a control — otherwise an author copying text out of the inspector would paste a node instead.
function onKeydown(event) {
  if (!props.editable || !(event.metaKey || event.ctrlKey)) return
  const target = event.target
  const tag = (target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
  if (event.key === 'c') copySelection()
  else if (event.key === 'v') pasteClipboard()
}
onMounted(() => addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  alive = false
  removeEventListener('keydown', onKeydown)
})

// A type or mode change can strand an edge; prune it before the save carries it. AWAITS a fresh answer:
// this deletes the author's wiring, and the old JS twin could get it wrong with nothing to catch it.
async function pruneEdges() {
  edges.value = pruneInvalidEdges(
    nodes.value,
    edges.value,
    await resolveGraphContext(graphNodes.value),
  )
}

// Deleting a node takes its edges with it; a dangling edge is a graph the validator refuses.
function removeNode(nodeId) {
  nodes.value = nodes.value.filter((n) => n.id !== nodeId)
  edges.value = edges.value.filter(
    (e) => e.source !== nodeId && e.target !== nodeId,
  )
  selectedId.value = null
}

// Called by the host on Save. Reads live positions/viewport straight from the instance.
// Refuses to serialise a canvas that never loaded. The graph is built only once the node-type contract
// arrives; if that request failed, `nodes` is empty for a workflow that HAS nodes, and saving that
// emptiness deletes the entire graph. Returning null makes the caller stop instead of writing nothing.
function serialize() {
  if (!nodeTypesReady.value) return null

  const obj = toObject()
  const vp = {
    x: obj.position?.[0] ?? 0,
    y: obj.position?.[1] ?? 0,
    zoom: obj.zoom ?? 1,
  }
  return flowToDefinition(obj.nodes, obj.edges, vp)
}

defineExpose({ serialize, ready: nodeTypesReady, dirty, markClean })
</script>

<style scoped>
/* C.7 — @vue-flow's default theme hardcodes light-mode colours, so in dark mode the controls, minimap
   and edge strokes stay light. Rebind its own custom properties to our theme-aware tokens; the vendor
   rules then follow the theme without patching vendor CSS. */
:deep(.vue-flow) {
  --vf-node-bg: var(--surface-white);
  --vf-node-text: var(--ink-gray-8);
  --vf-node-color: var(--outline-gray-2);
  --vf-handle: var(--ink-gray-5);
  --vf-connection-path: var(--ink-gray-5);
}
:deep(.vue-flow__edge-path),
:deep(.vue-flow__connection-path) {
  stroke: var(--ink-gray-4);
}
:deep(.vue-flow__controls-button) {
  background: var(--surface-white);
  border-bottom: 1px solid var(--outline-gray-2);
  fill: var(--ink-gray-7);
}
:deep(.vue-flow__minimap) {
  background: var(--surface-gray-1);
}
:deep(.vue-flow__edge-text) {
  fill: var(--ink-gray-6);
}
</style>
