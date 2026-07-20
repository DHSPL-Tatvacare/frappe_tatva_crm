<!-- TATVA: node palette (left rail) — grouped by category, tiles shaped like the cards they drop. -->
<!-- Every tile is the same height: the description is ONE line, truncated, with the full text on hover.
     The rail is for choosing a node, not for reading about it — the inspector shows the whole
     description once the node is placed. -->
<template>
  <aside
    class="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-outline-gray-2 bg-surface-gray-1 p-3"
  >
    <div v-for="group in groups" :key="group.key" class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5 px-1">
        <span class="text-[10px] font-semibold uppercase tracking-wider" :class="group.category.text">
          {{ __(group.category.label) }}
        </span>
        <span class="h-px flex-1" :class="group.category.chip" />
      </div>

      <div
        v-for="t in group.types"
        :key="t.type"
        class="group overflow-hidden rounded-md border bg-surface-white shadow-sm transition-shadow"
        :class="[
          group.category.border,
          t.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab hover:shadow-md active:cursor-grabbing',
        ]"
        :draggable="!t.disabled"
        :title="t.disabled ? __('This workflow already has a Trigger.') : __(t.description)"
        @dragstart="onDragStart($event, t)"
      >
        <div class="flex items-center gap-2 px-2 py-1" :class="group.category.bar">
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded"
            :class="group.category.chip"
          >
            <component :is="iconFor(t.type)" class="h-2.5 w-2.5" />
          </span>
          <span class="truncate text-xs font-semibold text-ink-gray-8">{{ __(t.label) }}</span>
        </div>
        <p
          class="truncate px-2 py-1.5 text-[10px] leading-[15px] text-ink-gray-6"
          :title="__(t.description)"
        >
          {{ __(t.description) }}
        </p>
      </div>
    </div>

    <p class="px-1 text-[10px] leading-snug text-ink-gray-4">
      {{ __('Drag a node onto the canvas, then connect the handles.') }}
    </p>
  </aside>
</template>
<script setup>
import { computed } from 'vue'
import { CATEGORIES, categoryFor, iconFor } from './nodeCatalog'
import { useNodeTypes } from '@/tatva/useNodeTypes'

const props = defineProps({
  // Node types already on the canvas, so a singleton the workflow owns is offered but not draggable.
  present: { type: Array, default: () => [] },
})

const { nodeTypes } = useNodeTypes()

// Grouped in CATEGORIES' own order, so the rail reads start → act → decide → wait → end rather than
// whatever order the registry happens to declare. A category with no types simply does not appear.
const groups = computed(() =>
  Object.entries(CATEGORIES)
    .map(([key, category]) => ({
      key,
      category,
      types: nodeTypes.value
        .filter((t) => categoryFor(t.type) === category)
        .map((t) => ({ ...t, disabled: t.singleton && props.present.includes(t.type) })),
    }))
    .filter((group) => group.types.length),
)

// A Trigger is SHOWN even though only one may exist: hiding it left an author with no way to add the
// one node without which nothing ever fires, and no clue that it was missing. It is offered, and
// disabled once the workflow has one.
function onDragStart(event, t) {
  if (t.disabled) return event.preventDefault()
  event.dataTransfer.setData('application/workflow-node', t.type)
  event.dataTransfer.effectAllowed = 'move'
}
</script>
