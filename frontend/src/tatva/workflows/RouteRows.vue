<!-- TATVA: the rows a Route branches on — (label, condition), tried top to bottom, first match wins. One
     row per branch, one handle per row, plus a reserved Otherwise nothing can fall through. Rows are
     DRAG-REORDERABLE because order IS the logic; the id never changes on a reorder, so the edge wired to a
     row follows it. Same {id,label} row shape as a Wait button. -->
<template>
  <div class="flex flex-col gap-2">
    <div ref="listEl" class="flex flex-col gap-2">
      <div
        v-for="(row, i) in rows"
        :key="row.id"
        class="flex flex-col gap-1.5 rounded-md border border-outline-gray-2 bg-surface-gray-1 p-2"
      >
        <div class="flex items-center gap-1.5">
          <div
            class="route-drag flex h-7 w-5 shrink-0 items-center justify-center"
            :class="disabled ? 'pointer-events-none opacity-40' : 'cursor-grab'"
          >
            <DragVerticalIcon class="h-4 w-4 text-ink-gray-5" />
          </div>
          <span
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-gray-3 text-xs font-medium text-ink-gray-6"
          >
            {{ i + 1 }}
          </span>
          <FormControl
            type="text"
            class="flex-1"
            :modelValue="row.label"
            :disabled="disabled"
            :placeholder="__('Label, e.g. Qualified')"
            @update:modelValue="(v) => setLabel(i, v)"
          />
          <Button variant="ghost" icon="x" :disabled="disabled" :label="__('Remove')" @click="remove(i)" />
        </div>
        <PredicateBuilder
          :modelValue="row.condition || null"
          :fields="fields"
          :operatorShapes="operatorShapes"
          :operatorsByType="operatorsByType"
          :subject="subject"
          :disabled="disabled"
          @update:modelValue="(v) => setCondition(i, v)"
        />
      </div>
    </div>

    <Button
      variant="subtle"
      icon-left="plus"
      :disabled="disabled"
      :label="__('Add route')"
      @click="add"
    />

    <!-- Reserved and always present: the author cannot forget fall-through, and a lead can never fall out
         of the graph. Shown so the Otherwise handle on the canvas is never a surprise. -->
    <div
      class="flex items-center gap-1.5 rounded-md border border-dashed border-outline-gray-3 px-2 py-1.5 text-xs text-ink-gray-5"
    >
      <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-gray-4">*</span>
      {{ __('Otherwise — every lead that matched no route above. Wire it so no one falls through.') }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Button, FormControl } from 'frappe-ui'
import { useSortable } from '@vueuse/integrations/useSortable'
import PredicateBuilder from '@/tatva/PredicateBuilder.vue'
import DragVerticalIcon from '@/components/Icons/DragVerticalIcon.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  // Passed straight through to each row's PredicateBuilder — the SAME vocabulary the standalone Predicate
  // control uses, so a condition means one thing wherever it is authored.
  fields: { type: Array, default: () => [] },
  operatorShapes: { type: Object, default: () => ({}) },
  operatorsByType: { type: Object, default: () => ({}) },
  subject: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

// Local render source, so `useSortable` (which mutates its list on drop, exactly like SortBy.vue) and Vue
// agree on the DOM. Synced FROM the parent only when the parent genuinely differs, so our own emits — a
// keystroke in a label — never recycle the array under the author's cursor.
const rows = ref(clone(props.modelValue))
watch(
  () => props.modelValue,
  (v) => {
    if (JSON.stringify(v || []) !== JSON.stringify(rows.value)) rows.value = clone(v)
  },
)

const listEl = ref(null)
// Reorder mutates ORDER only — the id is untouched, so the edge keyed on that id follows its row. `onEnd`
// (not a new event) pushes the reordered list up through the same v-model the control already uses.
useSortable(listEl, rows, {
  handle: '.route-drag',
  animation: 150,
  onEnd: () => emit('update:modelValue', rows.value),
})

function clone(v) {
  return JSON.parse(JSON.stringify(v || []))
}
// A stable id per row so reordering or renaming never re-keys the edge wired to it. Not Date.now()-based:
// two rows added in the same tick would collide.
function newId() {
  return 'r' + Math.random().toString(36).slice(2, 8)
}
function commit(next) {
  rows.value = next
  emit('update:modelValue', next)
}
function setLabel(i, value) {
  commit(rows.value.map((r, n) => (n === i ? { ...r, label: value } : r)))
}
function setCondition(i, value) {
  commit(rows.value.map((r, n) => (n === i ? { ...r, condition: value } : r)))
}
function add() {
  commit([...rows.value, { id: newId(), label: '', condition: null }])
}
function remove(i) {
  commit(rows.value.filter((_, n) => n !== i))
}
</script>
