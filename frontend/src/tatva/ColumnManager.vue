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
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <!-- LEFT: available -->
    <div class="flex min-h-0 flex-col">
      <div class="mb-2 flex items-center gap-2">
        <span class="text-sm font-medium text-ink-gray-8">{{ __('Select columns') }}</span>
        <span class="rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs tabular-nums text-ink-gray-6">
          {{ selected.length }}/{{ fields.length }}
        </span>
      </div>
      <FormControl
        v-model="search"
        type="text"
        :placeholder="__('Search')"
        class="mb-2"
      >
        <template #prefix>
          <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
        </template>
      </FormControl>
      <div class="flex max-h-72 flex-col overflow-y-auto rounded border border-outline-gray-2">
        <label
          v-for="f in filteredFields"
          :key="f.fieldname"
          class="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm text-ink-gray-8 hover:bg-surface-gray-2"
        >
          <Checkbox
            :modelValue="isSelected(f.fieldname)"
            @update:modelValue="() => toggle(f.fieldname)"
          />
          <span class="truncate">{{ f.label || f.fieldname }}</span>
        </label>
        <div v-if="!filteredFields.length" class="px-2.5 py-6 text-center text-sm text-ink-gray-4">
          {{ __('No fields match.') }}
        </div>
      </div>
    </div>

    <!-- RIGHT: selected + reorder -->
    <div class="flex min-h-0 flex-col sm:border-l sm:border-outline-gray-2 sm:pl-4">
      <div class="mb-2 flex items-center gap-2">
        <span class="text-sm font-medium text-ink-gray-8">{{ __('Selected columns') }}</span>
        <span class="rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs tabular-nums text-ink-gray-6">
          {{ items.length }}
        </span>
      </div>
      <div class="max-h-72 overflow-y-auto rounded border border-outline-gray-2">
        <Draggable
          :list="items"
          item-key="fieldname"
          handle=".drag-handle"
          :delay="isTouchScreenDevice() ? 200 : 0"
          class="flex flex-col"
          @end="emitOrder"
        >
          <template #item="{ element }">
            <div class="flex items-center gap-2 px-2.5 py-2 text-sm text-ink-gray-8 hover:bg-surface-gray-2">
              <DragIcon class="drag-handle h-3.5 w-3.5 shrink-0 cursor-grab text-ink-gray-4" />
              <span class="min-w-0 flex-1 truncate">{{ element.label || element.fieldname }}</span>
              <Button variant="ghost" icon="x" @click="remove(element.fieldname)" />
            </div>
          </template>
        </Draggable>
        <div v-if="!items.length" class="px-2.5 py-6 text-center text-sm text-ink-gray-4">
          {{ __('No columns chosen — the default set is used.') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { FormControl, Checkbox, Button, FeatherIcon } from 'frappe-ui'
import DragIcon from '@/components/Icons/DragIcon.vue'
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
function emitOrder() {
  model.value = items.value.map((i) => i.fieldname)
}
</script>
