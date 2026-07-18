<!-- TATVA: the orchestration editor. Palette (drag-to-add) on the left, the Vue Flow graph in the middle,
     the meta-driven inspector on the right. Owns nodes/edges/selection; serialises back to
     { nodes, canvas } for a standard save. validate() on the doctype is the only authoritative gate. -->
<template>
  <div class="flex h-full w-full">
    <NodePalette v-if="editable" />

    <div class="relative flex-1" @drop="onDrop">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :nodes-draggable="editable"
        :nodes-connectable="editable"
        :elements-selectable="true"
        :min-zoom="0.2"
        :max-zoom="2"
        :fit-view-on-init="!startViewport"
        @dragover="onDragOver"
      >
        <Background pattern-color="#cbd5e1" :gap="16" />
        <Controls />
        <MiniMap pannable zoomable />
        <template #node-campaign="nodeProps">
          <CampaignNode v-bind="nodeProps" />
        </template>
      </VueFlow>
    </div>

    <NodeInspector
      v-if="selectedNode"
      :node="selectedNode.data.node"
      :editable="editable"
      @close="selectedId = null"
      @shape-change="pruneEdges(selectedId)"
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
import { ref, computed } from 'vue'
import CampaignNode from './CampaignNode.vue'
import NodePalette from './NodePalette.vue'
import NodeInspector from './NodeInspector.vue'
import { definitionToFlow, flowToDefinition, handlesForNode } from './graphMap'

const props = defineProps({
  definition: { type: Object, required: true }, // the loaded CRM Workflow Definition doc
  editable: { type: Boolean, default: false },
})

function parseCanvas() {
  try {
    return props.definition.canvas_json ? JSON.parse(props.definition.canvas_json) : {}
  } catch {
    return {}
  }
}
const canvas = parseCanvas()
const startViewport = canvas.viewport || null

const { flowNodes, flowEdges } = definitionToFlow(props.definition.nodes || [], canvas)
const nodes = ref(flowNodes)
const edges = ref(flowEdges)
const selectedId = ref(null)
const selectedNode = computed(
  () => nodes.value.find((n) => n.id === selectedId.value) || null,
)

const {
  onConnect,
  onInit,
  onNodeClick,
  onPaneClick,
  setViewport,
  screenToFlowCoordinate,
  toObject,
} = useVueFlow()

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
  const type = event.dataTransfer.getData('application/campaign-node')
  if (!type) return
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  const id = newNodeId(type)
  const nodeRow = { node_id: id, node_type: type }
  if (type === 'Wait') nodeRow.wait_mode = 'For Duration'
  nodes.value.push({ id, type: 'campaign', position, data: { node: nodeRow } })
  selectedId.value = id
}

function newNodeId(type) {
  const base = type.toLowerCase()
  const existing = new Set(nodes.value.map((n) => n.id))
  let i = 1
  while (existing.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

// After a node's type/wait_mode changes, drop edges whose source handle no longer exists.
function pruneEdges(nodeId) {
  const n = nodes.value.find((x) => x.id === nodeId)
  if (!n) return
  const valid = new Set(handlesForNode(n.data.node).map((h) => h.id))
  edges.value = edges.value.filter(
    (e) => !(e.source === nodeId && !valid.has(e.sourceHandle)),
  )
}

// Called by the host on Save. Reads live positions/viewport straight from the instance.
function serialize() {
  const obj = toObject()
  const vp = {
    x: obj.position?.[0] ?? 0,
    y: obj.position?.[1] ?? 0,
    zoom: obj.zoom ?? 1,
  }
  return flowToDefinition(obj.nodes, obj.edges, vp)
}

defineExpose({ serialize })
</script>
