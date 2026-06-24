<template>
  <div v-if="showGroupedRows" class="mx-3 mt-2 h-full overflow-y-auto sm:mx-5">
    <div v-for="group in reactivieRows" :key="group.group">
      <ListGroupHeader :group="group">
        <div
          class="my-2 flex items-center gap-2 text-base font-medium text-ink-gray-8"
        >
          <div>{{ __(group.label) }} -</div>
          <div class="flex items-center gap-1">
            <component :is="group.icon" v-if="group.icon" />
            <div v-if="group.group == ' '" class="text-ink-gray-4">
              {{ __('Empty') }}
            </div>
            <div v-else>{{ group.group }}</div>
          </div>
        </div>
      </ListGroupHeader>
      <ListGroupRows :group="group">
        <ListRow
          v-for="row in group.rows"
          :key="row.name"
          v-slot="{ idx, column, item }"
          :row="row"
        >
          <slot v-bind="{ idx, column, item, row }" />
        </ListRow>
      </ListGroupRows>
    </div>
  </div>
  <!-- TATVA: restore the height/min-h-0 chain so the ungrouped list scrolls on mobile/PWA (matches the grouped container above) -->
  <ListRows
    v-else
    ref="scrollContainer"
    class="mx-3 h-full min-h-0 overflow-y-auto sm:mx-5"
    @scroll="handleScroll"
  >
    <ListRow
      v-for="row in reactivieRows"
      :key="row.name"
      v-slot="{ idx, column, item }"
      :row="row"
    >
      <slot v-bind="{ idx, column, item, row }" />
    </ListRow>
  </ListRows>
</template>

<script setup>
import { useStorage } from '@vueuse/core'
import { ListRows, ListRow, ListGroupHeader, ListGroupRows } from 'frappe-ui'
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
  rows: { type: Array, required: true },
  doctype: { type: String, default: 'CRM Lead' },
})

const reactivieRows = ref(props.rows)

watch(
  () => props.rows,
  (val) => (reactivieRows.value = val),
)

let showGroupedRows = computed(() => {
  return props.rows.every(
    (row) => row.group && row.rows && Array.isArray(row.rows),
  )
})

const scrollPosition = useStorage(`scrollPosition${props.doctype}`, 0)
const scrollContainer = ref(null)

const handleScroll = () => {
  if (scrollContainer.value) {
    scrollPosition.value = scrollContainer.value.$el.scrollTop
  }
}

onBeforeUnmount(() => {
  if (scrollContainer.value) {
    scrollContainer.value.$el.removeEventListener('scroll', handleScroll)
  }
})

onMounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.$el.addEventListener('scroll', handleScroll)
    scrollContainer.value.$el.scrollTop = scrollPosition.value
  }
})
</script>
