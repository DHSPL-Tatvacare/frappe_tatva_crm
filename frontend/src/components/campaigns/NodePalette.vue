<!-- TATVA: node palette (left rail) — the listing of node types you drag onto the canvas to add a node.
     Colours/icons come from the shared nodeCatalog, so a tile always matches its canvas card. -->
<template>
  <aside
    class="flex w-44 shrink-0 flex-col gap-2 overflow-y-auto border-r border-outline-gray-2 bg-surface-gray-1 p-3"
  >
    <div class="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-gray-5">
      {{ __('Nodes') }}
    </div>
    <div
      v-for="t in NODE_TYPES"
      :key="t.type"
      class="group flex cursor-grab items-center gap-2 rounded-md border border-outline-gray-2 bg-surface-white p-2 shadow-sm active:cursor-grabbing"
      draggable="true"
      @dragstart="onDragStart($event, t.type)"
    >
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        :class="styleFor(t.type).chip"
      >
        <component :is="iconFor(t.type)" class="h-3.5 w-3.5" />
      </span>
      <div class="min-w-0">
        <div class="truncate text-xs font-medium text-ink-gray-8">{{ t.label }}</div>
        <div class="truncate text-[10px] text-ink-gray-5">{{ t.hint }}</div>
      </div>
    </div>
    <p class="mt-1 px-1 text-[10px] leading-snug text-ink-gray-4">
      {{ __('Drag a node onto the canvas, then connect the handles.') }}
    </p>
  </aside>
</template>
<script setup>
import { NODE_TYPES, styleFor, iconFor } from './nodeCatalog'

function onDragStart(event, nodeType) {
  event.dataTransfer.setData('application/campaign-node', nodeType)
  event.dataTransfer.effectAllowed = 'move'
}
</script>
