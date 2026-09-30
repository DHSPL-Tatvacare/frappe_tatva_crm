<!-- TATVA: the rows a Route branches on — (label, condition), tried top to bottom, first match wins. One row per branch, one handle per row, plus a reserved Otherwise nothing can fall through. Rows are DRAG-REORDERABLE because order IS the logic; the id never changes on a reorder, so the edge wired to a row follows it. Same {id,label} row shape as a Wait button. -->
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
          :allFields="allFields"
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

    <!-- Reserved and always present: the author cannot forget fall-through, and a lead can never fall out of the graph. Shown so the Otherwise handle on the canvas is never a surprise. -->
    <div
      class="flex items-center gap-1.5 rounded-md border border-dashed border-outline-gray-3 px-2 py-1.5 text-xs text-ink-gray-5"
    >
      <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-gray-4">*</span>
      {{ __('Otherwise — every lead that matched no route above. Wire it so no one falls through.') }}
    </div>
  </div>
</template>

<script setup>
import { Button, FormControl } from 'frappe-ui'
import { useSortableRows } from './useSortableRows'
import PredicateBuilder from '@/tatva/PredicateBuilder.vue'
import DragVerticalIcon from '@/components/Icons/DragVerticalIcon.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  // Passed straight through to each row's PredicateBuilder — the SAME vocabulary the standalone Predicate control uses, so a condition means one thing wherever it is authored.
  fields: { type: Array, default: () => [] },
  // Also passed straight through: each row owns its own W3.1 escape hatch, so widening one route's field list does not silently widen the others.
  allFields: { type: Array, default: () => [] },
  operatorShapes: { type: Object, default: () => ({}) },
  operatorsByType: { type: Object, default: () => ({}) },
  subject: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const { rows, listEl, setField, add, remove } = useSortableRows(props, emit, {
  handle: '.route-drag',
  prefix: 'r',
  blank: { label: '', condition: null },
})
const setLabel = (i, value) => setField(i, 'label', value)
const setCondition = (i, value) => setField(i, 'condition', value)
</script>
