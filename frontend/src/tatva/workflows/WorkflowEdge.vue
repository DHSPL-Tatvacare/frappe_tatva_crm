<!-- TATVA: the canvas's one line — Vue Flow's own smoothstep path, or a lane around the cards for a loop or a line a card would cut (graphMap.planLanes); unlabelled since each output names itself at its dot, plus a red X at its middle to disconnect. -->
<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :style="style"
    :interaction-width="interactionWidth"
  />
  <EdgeLabelRenderer v-if="removable">
    <button
      v-show="selected || lineHovered || xHovered"
      ref="xButton"
      type="button"
      class="nodrag nopan absolute flex h-5 w-5 items-center justify-center rounded-full bg-surface-red-5 text-ink-white shadow-sm hover:bg-surface-red-6"
      :style="{ pointerEvents: 'all', transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)` }"
      :title="__('Disconnect')"
      :aria-label="__('Disconnect')"
      @click="removeEdges(id)"
    >
      <FeatherIcon name="x" class="h-3 w-3" />
    </button>
  </EdgeLabelRenderer>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useEdge, useVueFlow } from '@vue-flow/core'
import { FeatherIcon } from 'frappe-ui'
import { useElementHover } from '@vueuse/core'
import { LANES, lanePoints, roundedPath } from './graphMap'

const props = defineProps({
  id: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, required: true },
  targetPosition: { type: String, required: true },
  selected: { type: Boolean, default: false },
  markerEnd: { type: String, default: undefined },
  style: { type: Object, default: undefined },
  interactionWidth: { type: Number, default: undefined },
})

const { removeEdges, edgesUpdatable } = useVueFlow()
const { edgeEl } = useEdge()
const xButton = ref(null)

// The canvas plans every lane at once; a line with none is the built-in smoothstep, as before.
const lanes = inject(LANES, null)
// [path, x, y]: the shape Vue Flow's path helpers return, the X sitting halfway along the lane.
const path = computed(() => {
  const lane = lanes?.value?.get(props.id)
  if (!lane) return getSmoothStepPath(props)
  const s = { x: props.sourceX, y: props.sourceY }
  const t = { x: props.targetX, y: props.targetY }
  const pts = lanePoints(s, props.sourcePosition, t, lane.x)
  const run = pts.filter((p) => p.x === lane.x)
  return [roundedPath(pts), lane.x, (run[0].y + run[run.length - 1].y) / 2]
})
// A line can be disconnected only where lines can be edited: the canvas turns edge updating on for editors only.
const removable = computed(() => Boolean(edgesUpdatable.value))
// A short leave delay lets the pointer travel from the line onto its X without the X vanishing.
const lineHovered = useElementHover(edgeEl, { delayLeave: 300 })
const xHovered = useElementHover(xButton)
</script>
