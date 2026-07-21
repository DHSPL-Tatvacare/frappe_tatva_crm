<!-- TATVA: the orchestration editor. -->
<template>
  <div class="flex h-full w-full">
    <NodePalette v-if="editable && nodeTypesReady && !isMobileView" :present="presentTypes" />

    <!-- min-w-0 or the canvas cannot shrink below its content and the page scrolls sideways. -->
    <div class="relative min-w-0 flex-1" @drop="onDrop">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :nodes-draggable="editable && nodeTypesReady"
        :nodes-connectable="editable && nodeTypesReady"
        :delete-key-code="null"
        :elements-selectable="true"
        :min-zoom="0.2"
        :max-zoom="2"
        :fit-view-on-init="!startViewport"
        @dragover="onDragOver"
      >
        <Background pattern-color="var(--outline-gray-2)" :gap="16" />
        <Controls />
        <MiniMap pannable zoomable />
        <template #node-workflow="nodeProps">
          <WorkflowNode
            v-bind="nodeProps"
            :live="activeNodes[nodeProps.id] || ''"
            :problems="problemsByNode[nodeProps.id] || []"
            :waiting="counts.data?.waiting?.[nodeProps.id] || 0"
            :failed="counts.data?.failed?.[nodeProps.id] || 0"
          />
        </template>
      </VueFlow>
    </div>

    <NodeInspector
      v-if="selectedNode"
      :key="selectedId"
      :node="selectedNode.data.node"
      :editable="editable"
      :graph="graphNodes"
      :problems="problemsByNode[selectedId] || []"
      @close="selectedId = null"
      @update:config="applyConfig"
      @shape-change="pruneEdges"
      @delete="removeNode"
    />
  </div>
</template>
<script setup>
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import { ref, computed, watch } from 'vue'
import { createResource } from 'frappe-ui'
import { isMobileView } from '@/composables/settings'
import WorkflowNode from './WorkflowNode.vue'
import NodePalette from './NodePalette.vue'
import NodeInspector from './NodeInspector.vue'
import { definitionToFlow, flowToDefinition, pruneInvalidEdges } from './graphMap'
import { useNodeTypes } from '@/tatva/useNodeTypes'
import { useLiveRun } from './liveRun'

const props = defineProps({
  definition: { type: Object, required: true }, // the loaded CRM Workflow doc, with its nodes attached
  editable: { type: Boolean, default: false },
  // Publish faults as {node_id, field, message} — the canvas marks the nodes they name.
  problems: { type: Array, default: () => [] },
})

// Live run progress: the engine publishes each executed node to this workflow's doc room.
const { activeNodes } = useLiveRun(computed(() => props.definition?.name))

// Runs resting on each node, for the version on screen. A never-published workflow has no version and
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
    return props.definition.canvas_json ? JSON.parse(props.definition.canvas_json) : {}
  } catch {
    return {}
  }
}
const canvas = parseCanvas()
const startViewport = canvas.viewport || null

const { nodeTypesReady, outputsFor } = useNodeTypes()

const nodes = ref([])
const edges = ref([])
const selectedId = ref(null)

// Guarded immediate watcher: the registry arrives asynchronously and the mapping needs it.
watch(
  nodeTypesReady,
  (ready) => {
    if (!ready || nodes.value.length) return
    const built = definitionToFlow(props.definition.nodes || [], canvas, outputsFor)
    nodes.value = built.flowNodes
    edges.value = built.flowEdges
  },
  { immediate: true },
)
// The inspector needs the whole graph to answer "which node can this Wait wait on".
const graphNodes = computed(() => nodes.value.map((n) => n.data.node))
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
const selectedNode = computed(
  () => nodes.value.find((n) => n.id === selectedId.value) || null,
)

const {
  onConnect,
  onInit,
  onNodeClick,
  onNodeDragStop,
  onPaneClick,
  setViewport,
  screenToFlowCoordinate,
  toObject,
} = useVueFlow()

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
    nodes: nodes.value.map((n) => [n.id, n.data.node.node_type, n.data.node.config_json]),
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
  committed.value = { content: contentSignature.value, layout: layoutVersion.value }
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
      (e) => !(e.source === params.source && e.sourceHandle === params.sourceHandle),
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
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  const id = newNodeId(type)
  // Born with empty settings: what a type takes is the registry's to declare and the inspector's to ask for.
  const nodeRow = { node_id: id, node_type: type, config_json: '{}', edges: [] }
  nodes.value.push({ id, type: 'workflow', position, data: { node: nodeRow } })
  selectedId.value = id
}

// A node id is not a label: it goes into edges, into the correlation token a raised task carries
// (`run::node`), and into the problems the canvas anchors. Spaces there are a liability, so a type like
// "Update Field" becomes `update-field-1`, not `update field-1`.
function newNodeId(type) {
  const base = type.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const existing = new Set(nodes.value.map((n) => n.id))
  let i = 1
  while (existing.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

// A type or mode change can strand an edge; prune it before the save carries it.
function pruneEdges() {
  edges.value = pruneInvalidEdges(nodes.value, edges.value, outputsFor)
}

// Deleting a node takes its edges with it; a dangling edge is a graph the validator refuses.
function removeNode(nodeId) {
  nodes.value = nodes.value.filter((n) => n.id !== nodeId)
  edges.value = edges.value.filter((e) => e.source !== nodeId && e.target !== nodeId)
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
