<!-- TATVA: the canvas's one line — Vue Flow's own smoothstep path and label, plus a red X at its middle to disconnect, shown on hover or when selected. -->
<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :style="style"
    :label="label"
    :label-x="path[1]"
    :label-y="path[2]"
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
import { computed, ref } from 'vue'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useEdge, useVueFlow } from '@vue-flow/core'
import { FeatherIcon } from 'frappe-ui'
import { useElementHover } from '@vueuse/core'

const props = defineProps({
  id: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, required: true },
  targetPosition: { type: String, required: true },
  label: { type: [String, Object], default: undefined },
  selected: { type: Boolean, default: false },
  markerEnd: { type: String, default: undefined },
  style: { type: Object, default: undefined },
  interactionWidth: { type: Number, default: undefined },
})

const { removeEdges, edgesUpdatable } = useVueFlow()
const { edgeEl } = useEdge()
const xButton = ref(null)

// Same path maths as the built-in smoothstep edge, so the line looks exactly as before.
const path = computed(() => getSmoothStepPath(props))
// A line can be disconnected only where lines can be edited: the canvas turns edge updating on for editors only.
const removable = computed(() => Boolean(edgesUpdatable.value))
// A short leave delay lets the pointer travel from the line onto its X without the X vanishing.
const lineHovered = useElementHover(edgeEl, { delayLeave: 300 })
const xHovered = useElementHover(xButton)
</script>
