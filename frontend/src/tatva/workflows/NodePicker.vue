<!-- TATVA: the node list a line dropped on empty canvas offers, in the palette's groups, styled as frappe-ui's Dropdown; frappe-ui Popover because Dropdown cannot be opened from code. -->
<template>
  <Popover
    v-model:show="show"
    class="absolute"
    :style="{ left: `${at.x}px`, top: `${at.y}px` }"
  >
    <template #target><span /></template>
    <template #body-main>
      <div class="max-h-80 w-56 divide-y divide-outline-gray-modals overflow-y-auto">
        <div v-for="group in groups" :key="group.key" class="p-1.5">
          <div class="flex h-7 items-center px-2 text-sm font-medium text-ink-gray-5">
            {{ __(group.category.label) }}
          </div>
          <button
            v-for="t in group.types"
            :key="t.type"
            type="button"
            class="group flex h-7 w-full items-center gap-2 rounded px-2 text-base text-ink-gray-7 hover:bg-surface-gray-3 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="t.disabled"
            @click="pick(t.type)"
          >
            <NodeChip :type="t.type" />
            <span class="truncate">{{ __(t.label) }}</span>
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>

<script setup>
import { Popover } from 'frappe-ui'
import NodeChip from './NodeChip.vue'

defineProps({
  // Where the line was dropped, in pixels inside the canvas.
  at: { type: Object, required: true },
  // `groupNodeTypes`' answer, the same list the palette draws.
  groups: { type: Array, required: true },
})
const emit = defineEmits(['pick'])
const show = defineModel('show', { type: Boolean, default: false })

function pick(type) {
  show.value = false
  emit('pick', type)
}
</script>
