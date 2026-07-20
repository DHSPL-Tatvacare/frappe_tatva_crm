<!--
  ConditionBuilder — a GENERIC, inline AND-condition editor over a supplied field list.

  Knows nothing about Smart Views (or any doctype): you hand it a `fields` list
  ({fieldname, label, fieldtype, options}) and a v-model predicate, and it renders the
  conditions INLINE (no popover that can escape a host modal):

      Where  [field ▾]  [operator ▾]  [value]   ✕
      And    [field ▾]  [operator ▾]  [value]   ✕
      + Add condition

  v-model shape is the composer predicate tree (a flat AND group), emitted directly:
      { op: 'and', conditions: [ { field, operator, value }, … ] }   |   null when empty

  Operators/value-widgets are derived from each field's fieldtype — nothing is hardcoded to a
  particular field. Reuse it anywhere a predicate-over-a-catalog is needed.
-->
<template>
  <div class="flex min-h-0 flex-col gap-2">
    <!-- Rows scroll; "Add condition" below stays put, so it is never the control pushed off the modal. -->
    <FadedScrollableDiv v-if="rows.length" class="flex max-h-[42vh] flex-col gap-2 overflow-y-auto pr-0.5">
      <!-- Grid, not flex-wrap: every control sets `w-full` on its own root, so wrap put field and operator on separate lines. -->
      <div
        v-for="(row, i) in rows"
        :key="i"
        class="grid grid-cols-[3.5rem_minmax(0,1fr)_9rem_minmax(0,1fr)_auto] items-center gap-2"
      >
        <span class="text-right text-sm text-ink-gray-5">
          {{ i === 0 ? __('Where') : __('And') }}
        </span>
        <!-- Searchable field picker: the catalog can hold 100+ fields, so a plain <select> is
             unusable. Autocomplete is the same searchable primitive the native Filter (CFCondition)
             uses; it emits the chosen option object, so we take its .value (the fieldname). -->
        <Autocomplete
          class="min-w-0"
          :modelValue="row.field"
          :options="fieldOptions"
          :placeholder="__('Field')"
          @update:modelValue="(v) => onField(i, v?.value ?? null)"
        />
        <FormControl
          type="select"
          class="min-w-0"
          :modelValue="row.operator"
          :options="operatorOptions(row.field)"
          @update:modelValue="(v) => onOperator(i, v)"
        />
        <component
          :is="valueComponent(row)"
          v-if="valueKind(row) !== 'none'"
          class="min-w-0"
          :modelValue="row.value"
          v-bind="valueProps(row)"
          @update:modelValue="(v) => onValue(i, v)"
        />
        <div v-else />
        <Button
          variant="ghost"
          icon="x"
          :label="''"
          @click="removeRow(i)"
        />
      </div>
    </FadedScrollableDiv>

    <div>
      <Button
        variant="ghost"
        iconLeft="plus"
        :label="__('Add condition')"
        class="!text-ink-gray-6"
        :disabled="!fields.length"
        @click="addRow"
      />
    </div>
  </div>
</template>

<script setup>
import {
  FormControl,
  Button,
  Autocomplete,
  DatePicker,
  DateTimePicker,
  DateRangePicker,
} from 'frappe-ui'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import Link from '@/components/Controls/Link.vue'
import { timespanOptions } from '@/utils/timespanOptions'
import DurationInput from '@/components/Controls/DurationInput.vue'
import RatingInput from '@/components/Controls/RatingInput.vue'
import { computed, ref, watch } from 'vue'

const props = defineProps({
  // Available fields: { fieldname, label, fieldtype, options }
  fields: { type: Array, default: () => [] },
})
const model = defineModel({ type: Object, default: () => null })

// ---- fieldtype buckets (drive operators + value widget; no field is hardcoded) ----
const TEXT = ['Data', 'Small Text', 'Text', 'Long Text', 'Text Editor', 'Code']
const NUMBER = ['Int', 'Float', 'Currency', 'Percent']
const DATE = ['Date', 'Datetime']
const LINKY = ['Link', 'Dynamic Link']

const OPS = {
  text: ['like', 'not like', '=', '!=', 'is set', 'is not set'],
  number: ['=', '!=', '>', '<', '>=', '<=', 'is set', 'is not set'],
  // `between` first — what native Filter defaults a date to; omitting it barred authored date ranges.
  date: ['between', 'timespan', '=', '!=', '>', '<', '>=', '<=', 'is set', 'is not set'],
  select: ['=', '!=', 'is set', 'is not set'],
  link: ['=', '!=', 'like', 'is set', 'is not set'],
  check: ['='],
  duration: ['=', '!=', '>', '<', '>=', '<=', 'is set', 'is not set'],
  rating: ['=', '!=', '>', '<', '>=', '<=', 'is set', 'is not set'],
}
const OP_LABELS = {
  '=': __('Equals'),
  '!=': __('Not equals'),
  '>': __('>'),
  '<': __('<'),
  '>=': __('≥'),
  '<=': __('≤'),
  like: __('Like'),
  'not like': __('Not like'),
  'is set': __('Is set'),
  'is not set': __('Is not set'),
}

const fieldByName = computed(() => {
  const m = {}
  for (const f of props.fields) m[f.fieldname] = f
  return m
})
const fieldOptions = computed(() =>
  props.fields.map((f) => ({ label: f.label || f.fieldname, value: f.fieldname })),
)

function kindOf(fieldname) {
  const f = fieldByName.value[fieldname]
  const t = f?.fieldtype
  if (t === 'Check') return 'check'
  if (t === 'Select') return 'select'
  if (t === 'Duration') return 'duration'
  if (t === 'Rating') return 'rating'
  if (NUMBER.includes(t)) return 'number'
  if (DATE.includes(t)) return 'date'
  if (LINKY.includes(t)) return 'link'
  if (TEXT.includes(t)) return 'text'
  return 'text'
}
function operatorOptions(fieldname) {
  return (OPS[kindOf(fieldname)] || OPS.text).map((o) => ({ label: OP_LABELS[o] || o, value: o }))
}
function defaultOperator(fieldname) {
  return (OPS[kindOf(fieldname)] || OPS.text)[0]
}

// ---- value widget per (kind, operator) ----
function valueKind(row) {
  if (row.operator === 'is set' || row.operator === 'is not set') return 'none'
  return kindOf(row.field)
}
// Same controls the native Filter.vue picks (its getValueComponent) — never a raw HTML input.
function valueComponent(row) {
  const kind = valueKind(row)
  if (row.operator === 'timespan') return FormControl
  if (kind === 'date') {
    if (row.operator === 'between') return DateRangePicker
    return fieldByName.value[row.field]?.fieldtype === 'Datetime' ? DateTimePicker : DatePicker
  }
  if (kind === 'link') return Link
  if (kind === 'duration') return DurationInput
  if (kind === 'rating') return RatingInput
  return FormControl
}

function valueProps(row) {
  const kind = valueKind(row)
  const field = fieldByName.value[row.field]
  // A named range is picked from frappe's own timespan vocabulary, never typed.
  if (row.operator === 'timespan') return { type: 'select', options: timespanOptions }
  if (kind === 'check')
    return { type: 'select', options: [{ label: __('Yes'), value: 1 }, { label: __('No'), value: 0 }] }
  if (kind === 'select') {
    const opts = (field?.options || '')
      .split('\n')
      .filter(Boolean)
      .map((o) => ({ label: o, value: o }))
    return { type: 'select', options: opts }
  }
  if (kind === 'number') return { type: 'number' }
  if (kind === 'date') return { iconLeft: '' }
  if (kind === 'link') return { doctype: field?.options || '', class: 'form-control' }
  if (kind === 'rating') return { max: Number(field?.options) || 5, class: '!flex' }
  if (kind === 'duration') return {}
  return { type: 'text' }
}

// ---- rows state (mirrors the model's flat AND conditions) ----
const rows = ref([])

function fromModel(m) {
  const conds = (m && Array.isArray(m.conditions) ? m.conditions : []).filter((c) => c && c.field)
  rows.value = conds.map((c) => ({ field: c.field, operator: c.operator || '=', value: c.value }))
}
fromModel(model.value)

// Re-seed when the bound predicate is replaced wholesale (e.g. editor opens / scope change).
watch(
  () => model.value,
  (m) => {
    if (sameAsRows(m)) return
    fromModel(m)
  },
)

function sameAsRows(m) {
  const conds = m && Array.isArray(m.conditions) ? m.conditions : []
  if (conds.length !== rows.value.length) return false
  return conds.every((c, i) => c.field === rows.value[i].field && c.operator === rows.value[i].operator && c.value === rows.value[i].value)
}

function emit() {
  // Drop incomplete rows (no field). is set/is not set carry no value.
  const conditions = rows.value
    .filter((r) => r.field)
    .map((r) => ({ field: r.field, operator: r.operator, value: valueKind(r) === 'none' ? null : r.value ?? '' }))
  model.value = conditions.length ? { op: 'and', conditions } : null
}

function addRow() {
  const first = props.fields[0]
  if (!first) return
  rows.value.push({ field: first.fieldname, operator: defaultOperator(first.fieldname), value: '' })
  emit()
}
function removeRow(i) {
  rows.value.splice(i, 1)
  emit()
}
function onField(i, v) {
  rows.value[i].field = v
  rows.value[i].operator = defaultOperator(v)
  rows.value[i].value = ''
  emit()
}
function onOperator(i, v) {
  rows.value[i].operator = v
  emit()
}
function onValue(i, v) {
  rows.value[i].value = v
  emit()
}
</script>
