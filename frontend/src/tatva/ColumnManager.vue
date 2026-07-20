<!--
  ColumnManager — a GENERIC two-panel column chooser (the "Manage Columns" pattern).

  Prop-driven, knows nothing about Smart Views: hand it the full `fields` list
  ({fieldname, label}) and a v-model of the selected, ORDERED keys. It renders:

    LEFT  "Select columns"  (selected/total)  — a search box + a checkbox list of every field.
    RIGHT "Selected columns"                   — the chosen columns, drag to reorder, ✕ to remove.

  v-model is `string[]` of fieldnames in display order. Reuse it anywhere a column set needs
  choosing + ordering. (Pinning is intentionally out — the underlying table can't freeze
  columns; the model stays a plain ordered list so pin can be layered on later with no churn.)
-->
<template>
  <!-- fixed row height + both panels flex-col so their lists bottom-align (no dead space on the right) -->
  <div class="grid grid-cols-1 gap-x-5 gap-y-3 sm:h-72 sm:grid-cols-2">
    <!-- LEFT: available -->
    <div class="flex min-h-0 flex-col">
      <div class="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink-gray-7">
        {{ __('Select columns') }}
        <span class="rounded bg-surface-gray-2 px-1 text-xs tabular-nums text-ink-gray-5">
          {{ selected.length }}/{{ fields.length }}
        </span>
      </div>
      <FormControl v-model="search" type="text" :placeholder="__('Search')" class="mb-1">
        <template #prefix>
          <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
        </template>
      </FormControl>
      <!-- select all / clear for the (search-filtered) list below -->
      <div class="mb-1 flex items-center gap-1">
        <Button variant="ghost" size="sm" :label="__('Select all')" @click="selectAll" />
        <Button v-if="items.length" variant="ghost" size="sm" :label="__('Clear')" @click="clearAll" />
      </div>
      <!-- Faded like step 2's condition list, so a long catalog reads as scrollable rather than sliced off. -->
      <FadedScrollableDiv class="min-h-0 flex-1 overflow-y-auto">
        <label
          v-for="f in filteredFields"
          :key="f.fieldname"
          class="flex h-8 cursor-pointer items-center gap-2 rounded px-1.5 text-sm text-ink-gray-8 duration-150 ease-in-out hover:bg-surface-gray-2"
        >
          <Checkbox :modelValue="isSelected(f.fieldname)" @update:modelValue="() => toggle(f.fieldname)" />
          <span class="truncate">{{ f.label || f.fieldname }}</span>
        </label>
        <div v-if="!filteredFields.length" class="px-1.5 py-3 text-sm text-ink-gray-4">
          {{ __('No fields match.') }}
        </div>
      </FadedScrollableDiv>
    </div>

    <!-- RIGHT: selected columns as tight individual cards (drag · label · ✕), no bounded box -->
    <div class="flex min-h-0 flex-col sm:border-l sm:border-outline-gray-2 sm:pl-5">
      <div class="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink-gray-7">
        {{ __('Selected columns') }}
        <span class="rounded bg-surface-gray-2 px-1 text-xs tabular-nums text-ink-gray-5">{{ items.length }}</span>
      </div>
      <!-- Same faded scroller and the same 8px row rhythm as the left pane, so the two halves read as one control. -->
      <FadedScrollableDiv v-if="items.length" class="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <Draggable
          :list="items"
          item-key="fieldname"
          handle=".drag-handle"
          :delay="isTouchScreenDevice() ? 200 : 0"
          class="flex flex-col gap-1"
          @end="emitOrder"
        >
          <template #item="{ element }">
            <div
              class="group/col flex h-8 items-center gap-2 rounded border border-outline-gray-2 bg-surface-white px-1.5 duration-150 ease-in-out hover:border-outline-gray-3"
            >
              <DragIcon class="drag-handle h-3.5 w-3.5 shrink-0 cursor-grab text-ink-gray-4" />
              <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ element.label || element.fieldname }}</span>
              <button
                type="button"
                :aria-label="__('Remove') + ' ' + (element.label || element.fieldname)"
                class="shrink-0 rounded p-0.5 text-ink-gray-4 duration-150 ease-in-out hover:bg-surface-gray-2 hover:text-ink-gray-7"
                @click="remove(element.fieldname)"
              >
                <FeatherIcon name="x" class="h-3.5 w-3.5" />
              </button>
            </div>
          </template>
        </Draggable>
      </FadedScrollableDiv>
      <div
        v-else
        class="flex min-h-0 flex-1 items-center justify-center rounded border border-dashed border-outline-gray-2 px-3 text-center text-sm text-ink-gray-4"
      >
        {{ __('No columns chosen — the default set is used.') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { FormControl, Checkbox, FeatherIcon, Button } from 'frappe-ui'
import DragIcon from '@/components/Icons/DragIcon.vue'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import Draggable from 'vuedraggable'
import { isTouchScreenDevice } from '@/utils'
import { computed, ref, watch } from 'vue'

const props = defineProps({
  // Every available field: { fieldname, label }
  fields: { type: Array, default: () => [] },
})
// v-model: ordered fieldnames (string[])
const model = defineModel({ type: Array, default: () => [] })

const search = ref('')
const fieldByName = computed(() => {
  const m = {}
  for (const f of props.fields) m[f.fieldname] = f
  return m
})

// `items` (ordered {fieldname,label}) is the draggable source of truth for the right panel.
const items = ref([])
function fromModel(keys) {
  items.value = (keys || [])
    .filter((k) => fieldByName.value[k])
    .map((k) => ({ fieldname: k, label: fieldByName.value[k]?.label || k }))
}
fromModel(model.value)

watch(
  () => model.value,
  (keys) => {
    const cur = items.value.map((i) => i.fieldname)
    if ((keys || []).length === cur.length && (keys || []).every((k, i) => k === cur[i])) return
    fromModel(keys)
  },
)
// Rebuild labels if the field list itself changes (e.g. scope switch).
watch(() => props.fields, () => fromModel(model.value))

const selected = computed(() => items.value.map((i) => i.fieldname))
const filteredFields = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.fields
  return props.fields.filter((f) => String(f.label || f.fieldname).toLowerCase().includes(q))
})

function isSelected(key) {
  return selected.value.includes(key)
}
function toggle(key) {
  if (isSelected(key)) items.value = items.value.filter((i) => i.fieldname !== key)
  else items.value.push({ fieldname: key, label: fieldByName.value[key]?.label || key })
  emitOrder()
}
function remove(key) {
  items.value = items.value.filter((i) => i.fieldname !== key)
  emitOrder()
}
// Select all currently-visible (search-filtered) fields; append any not already selected (order kept).
function selectAll() {
  const cur = new Set(selected.value)
  for (const f of filteredFields.value) {
    if (!cur.has(f.fieldname))
      items.value.push({ fieldname: f.fieldname, label: f.label || f.fieldname })
  }
  emitOrder()
}
function clearAll() {
  items.value = []
  emitOrder()
}
function emitOrder() {
  model.value = items.value.map((i) => i.fieldname)
}
</script>
