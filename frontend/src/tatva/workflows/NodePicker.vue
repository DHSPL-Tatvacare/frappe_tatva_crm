<!-- TATVA: the node list a line dropped on empty canvas offers, in the palette's groups; frappe-ui Popover because Dropdown cannot be opened from code, the list drawn by the shared MenuGroups. -->
<template>
  <Popover
    v-model:show="show"
    class="absolute"
    :style="{ left: `${at.x}px`, top: `${at.y}px` }"
  >
    <template #target><span /></template>
    <template #body-main>
      <MenuGroups class="w-56" :groups="menu" @select="pick">
        <template #item="{ item }">
          <NodeChip :type="item.type" />
          <span class="truncate">{{ __(item.label) }}</span>
        </template>
      </MenuGroups>
    </template>
  </Popover>
</template>

<script setup>
import { computed } from 'vue'
import { Popover } from 'frappe-ui'
import NodeChip from './NodeChip.vue'
import MenuGroups from './MenuGroups.vue'

const props = defineProps({
  // Where the line was dropped, in pixels inside the canvas.
  at: { type: Object, required: true },
  // `groupNodeTypes`' answer, the same list the palette draws.
  groups: { type: Array, required: true },
})
const emit = defineEmits(['pick'])
const show = defineModel('show', { type: Boolean, default: false })

const menu = computed(() => props.groups.map((g) => ({ key: g.key, label: __(g.category.label), items: g.types })))

function pick(item) {
  show.value = false
  emit('pick', item.type)
}
</script>
