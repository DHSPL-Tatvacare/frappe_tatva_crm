<template>
  <!-- TATVA: ONE scroll container for both modes, so Group By and back cannot strand the window on a node that is gone. -->
  <div
    ref="scrollContainer"
    class="mx-3 h-full min-h-0 overflow-y-auto sm:mx-5"
    @scroll="onScroll"
  >
    <!-- TATVA: `wrapperProps` carries the items off screen as height, so the scroll length is the whole list's. -->
    <div v-bind="wrapperProps">
      <template v-for="{ data: item } in itemsToRender" :key="item.key">
        <!-- A header and the gap below it are ONE box, measured off the DOM rather than declared. -->
        <div v-if="item.type === 'header'" :ref="measureHeader" class="pb-2">
          <ListGroupHeader :group="item.group">
            <div
              class="my-2 flex items-center gap-2 text-base font-medium text-ink-gray-8"
            >
              <div>{{ __(item.group.label) }} -</div>
              <div class="flex items-center gap-1">
                <component :is="item.group.icon" v-if="item.group.icon" />
                <div v-if="item.group.group == ' '" class="text-ink-gray-4">
                  {{ __('Empty') }}
                </div>
                <!-- TATVA: a group the caller gave a badge reads exactly as that value's cell does elsewhere. -->
                <Badge
                  v-else-if="item.group.badge"
                  variant="subtle"
                  :theme="item.group.badge.theme"
                  :label="item.group.badge.label"
                />
                <!-- TATVA: a group stays KEYED on the raw value (a grain master's key is composite); `groupLabel`, when the caller resolved one, is what a human reads. -->
                <div v-else>
                  {{ item.group.groupLabel || item.group.group }}
                </div>
              </div>
            </div>
          </ListGroupHeader>
        </div>
        <!-- The space `ListGroupRows` left under a group, kept as an item so the window can count it. -->
        <div v-else-if="item.type === 'tail'" :ref="measureTail" class="h-5" />
        <ListRow v-else v-slot="{ idx, column, item: cell }" :row="item.row">
          <slot v-bind="{ idx, column, item: cell, row: item.row }" />
        </ListRow>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useDebounceFn, useStorage, useVirtualList } from '@vueuse/core'
import { Badge, ListRow, ListGroupHeader } from 'frappe-ui'
import { ref, computed, inject, watch } from 'vue'

const props = defineProps({
  rows: { type: Array, required: true },
  doctype: { type: String, default: 'CRM Lead' },
})

// TATVA: a ref, not the prop — `ref()` proxies deeply, which is what makes a group's `collapsed` toggle reactive.
const sourceRows = ref(props.rows)
watch(
  () => props.rows,
  (val) => (sourceRows.value = val),
)

// TATVA: `ListView` stays the owner — the key and the row height are read off its provide, never restated here.
const list = inject('list', null)
const ROW_KEY = list?.value?.rowKey || 'name'
const declared = list?.value?.options?.rowHeight
const px = typeof declared === 'number' ? declared : parseInt(declared, 10)
// A row is the height `ListView` declares plus its separator; that declaration may be a number or a CSS length.
const ROW_HEIGHT = (Number.isFinite(px) ? px : 40) + 1

// A header and a group's trailing space have no declared height, so they are measured once from the DOM
// and the window is told what they really are. Nothing here is a number this file invented.
const headerHeight = ref(ROW_HEIGHT)
const tailHeight = ref(0)
// Read once per kind — these never change, and reading a rect on every render would force a layout each frame.
const measureOnce = (target) => {
  let done = false
  return (el) => {
    if (done || !el) return
    const h = el.getBoundingClientRect().height
    if (!h) return
    done = true
    target.value = h
  }
}
const measureHeader = measureOnce(headerHeight)
const measureTail = measureOnce(tailHeight)

// TATVA: an empty list is not a grouped one — `[].every()` answers true, and that used to decide which branch drew.
const isGrouped = computed(
  () =>
    sourceRows.value.length > 0 &&
    sourceRows.value.every((row) => row.group && Array.isArray(row.rows)),
)

// TATVA: one flat list of what is drawn — a header and a group's tail are items like any row, so both modes share one window.
const items = computed(() => {
  const asRow = (row) => ({ type: 'row', key: row[ROW_KEY], row })
  if (!isGrouped.value) return sourceRows.value.map(asRow)
  const flat = []
  for (const group of sourceRows.value) {
    flat.push({ type: 'header', key: `header:${group.group}`, group })
    if (!group.collapsed) for (const row of group.rows) flat.push(asRow(row))
    flat.push({ type: 'tail', key: `tail:${group.group}` })
  }
  return flat
})

const heightOf = (item) =>
  item?.type === 'header'
    ? headerHeight.value
    : item?.type === 'tail'
      ? tailHeight.value
      : ROW_HEIGHT

const scrollContainer = ref(null)

const {
  list: visibleItems,
  containerProps,
  wrapperProps,
} = useVirtualList(items, {
  itemHeight: (i) => heightOf(items.value[i]),
  overscan: 10,
})

// A screenful stands in until the container has been measured — the window cannot be sized before the element exists.
const measured = ref(false)
const itemsToRender = computed(() =>
  measured.value
    ? visibleItems.value
    : items.value.slice(0, 20).map((data, index) => ({ data, index })),
)

// A filter can leave the offset past the end of the shorter list it produced, and the window is only ever
// recomputed from a scroll — so the offset is brought back into range here and the range asked for again.
watch([items, headerHeight, tailHeight], ([val]) => {
  const element = containerProps.ref.value
  if (!element) return
  const total = val.reduce((sum, item) => sum + heightOf(item), 0)
  const furthest = Math.max(0, total - element.clientHeight)
  if (element.scrollTop > furthest) element.scrollTop = furthest
  containerProps.onScroll()
})

const scrollPosition = useStorage(`scrollPosition${props.doctype}`, 0)
const rememberPosition = useDebounceFn(
  (top) => (scrollPosition.value = top),
  200,
)

function onScroll(event) {
  containerProps.onScroll()
  rememberPosition(event.target.scrollTop)
}

// TATVA: bound from a watcher, not a lifecycle hook, so the window always addresses the element mounted now.
watch(
  scrollContainer,
  (element) => {
    if (!element) return
    containerProps.ref.value = element
    element.scrollTop = scrollPosition.value
    containerProps.onScroll()
    measured.value = true
  },
  { flush: 'post' },
)
</script>
