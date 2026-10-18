<!-- TATVA: the node list a line dropped on empty canvas, or a node's +, offers, in the palette's groups with a search and each node's own description; frappe-ui Popover because Dropdown cannot be opened from code, the list drawn by the shared MenuGroups. -->
<template>
  <Popover
    v-model:show="show"
    class="absolute"
    :style="{ left: `${at.x}px`, top: `${at.y}px` }"
  >
    <template #target><span /></template>
    <template #body-main>
      <div class="w-80 max-w-[calc(100vw-2rem)]">
        <div class="border-b border-outline-gray-modals p-1.5">
          <TextInput
            ref="search"
            v-model="query"
            type="text"
            :placeholder="__('Search nodes')"
            @keydown.enter.prevent="pickFirst"
          />
        </div>
        <MenuGroups v-if="menu.length" :groups="menu" @select="pick">
          <template #item="{ item }">
            <NodeChip :type="item.type" class="self-start mt-0.5" />
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ __(item.label) }}</span>
              <span v-if="item.description" class="block truncate text-xs text-ink-gray-5" :title="__(item.description)">
                {{ __(item.description) }}
              </span>
            </span>
          </template>
        </MenuGroups>
        <p v-else class="px-3 py-4 text-center text-sm text-ink-gray-5">{{ __('No node matches that search.') }}</p>
      </div>
    </template>
  </Popover>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Popover, TextInput } from 'frappe-ui'
import NodeChip from './NodeChip.vue'
import MenuGroups from './MenuGroups.vue'

const props = defineProps({
  // Where the line was dropped or the + was pressed, in pixels inside the canvas.
  at: { type: Object, required: true },
  // `groupNodeTypes`' answer, the same list the palette draws.
  groups: { type: Array, required: true },
})
const emit = defineEmits(['pick'])
const show = defineModel('show', { type: Boolean, default: false })

const query = ref('')
const search = ref(null)

// Matched on what the author reads, the label and the description; a group with nothing left is dropped, and a disabled node still shows so the author learns why it is missing.
const menu = computed(() => {
  const words = query.value.trim().toLowerCase()
  return props.groups
    .map((g) => ({
      key: g.key,
      label: __(g.category.label),
      items: g.types.filter((t) => !words || `${__(t.label)} ${__(t.description || '')}`.toLowerCase().includes(words)),
    }))
    .filter((g) => g.items.length)
})

// Each opening starts from an empty search with the cursor in it.
watch(show, async (open) => {
  if (!open) return
  query.value = ''
  await nextTick()
  search.value?.el?.focus?.()
})

function pick(item) {
  show.value = false
  emit('pick', item.type)
}

function pickFirst() {
  const first = menu.value.flatMap((g) => g.items).find((t) => !t.disabled)
  if (first) pick(first)
}
</script>
