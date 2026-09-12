<!--
  ConditionBuilder — a GENERIC, inline condition editor over a supplied field list.

  Its grammar is the automation builder's (tatva/PredicateBuilder): ONE group, joined by All of / Any of /
  None of, stated once above the rows. It is the FLAT half of that control — no nested groups — which is
  what this surface's composer stores; unifying the two components is the open piece of work.

  Knows nothing about Smart Views (or any doctype): you hand it a `fields` list
  ({fieldname, label, fieldtype, options}) and a v-model predicate, and it renders the
  conditions INLINE (no popover that can escape a host modal):

      Match [All of ▾]  every condition must hold
      [field ▾]  [operator ▾]  [value]   ✕
      [field ▾]  [operator ▾]  [value]   ✕

  ONE ROW PER CONDITION at sm and up; below it the row STACKS into a bordered card, because the fixed
  operator column left the field 80px on a 390px phone — not overflowing, just unreadable.
      + Add condition

  v-model shape is the composer predicate tree (one flat group), emitted directly:
      { op: 'and'|'or'|'not', conditions: [ { field, operator, value }, … ] }   |   null when empty
  ONE joiner for the group — the shape the server reads. Mixed nesting is deliberately not offered.

  Operators/value-widgets are derived from each field's fieldtype — nothing is hardcoded to a
  particular field. Reuse it anywhere a predicate-over-a-catalog is needed.
-->
<template>
  <div class="flex min-h-0 flex-col">
    <!-- THE GROUP, framed exactly as the automation builder frames one (tatva/PredicateBuilder): a tinted
         bordered panel, its joiner and hint in the header, its conditions indented inside, its "add" at the
         foot. Same shape, same words, so the two authoring surfaces read as one product. -->
    <div class="flex min-h-0 flex-col rounded border border-outline-gray-2 bg-surface-gray-1 p-2.5">
      <!-- ONE joiner for the group. A connector drawn on every row implies per-row logic — that you could
           say "A and B or C" — which this flat group cannot express and the composer does not store. -->
      <div v-if="rows.length" class="mb-2 flex items-center gap-2">
        <FormControl
          type="select"
          class="w-28"
          :modelValue="joiner"
          :options="joinerOptions"
          @update:modelValue="setJoiner"
        />
        <span class="text-xs text-ink-gray-5">{{ joinerHint }}</span>
        <div class="flex-1" />
      </div>

      <!-- THE ONLY HEIGHT IN THIS TREE, and it belongs here: conditions are the one thing that can grow
           without bound, and the dialog above is content-sized by contract. Capped in `dvh` so the modal
           can never outgrow the screen, and the rows scroll while "Add condition" and the footer stay put. -->
      <FadedScrollableDiv
        v-if="rows.length"
        class="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto pl-2 pr-0.5"
      >
        <!-- ONE ROW PER CONDITION at sm and up; below it the row stacks into a card, because the fixed
             operator column left the field 80px on a phone — not overflowing, just unreadable. -->
        <div
          v-for="(row, i) in rows"
          :key="i"
          class="flex flex-col gap-2 rounded-md border border-outline-gray-1 bg-surface-white p-2 sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto] sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
        >
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
            :class="incomplete.includes(row) ? 'rounded ring-1 ring-outline-red-2' : ''"
            :modelValue="row.value"
            v-bind="valueProps(row)"
            @update:modelValue="(v) => onValue(i, v)"
          />
          <div v-else />
          <Button
            class="self-end sm:self-auto"
            variant="ghost"
            icon="x"
            :label="''"
            @click="removeRow(i)"
          />
        </div>
      </FadedScrollableDiv>

      <div class="mt-2 flex gap-2 pl-2">
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
import { computed, watchEffect } from 'vue'

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
  // Both are offered for every date (OPS.date), and without a label they rendered as the raw, untranslated
  // token beside properly-labelled siblings.
  between: __('Between'),
  timespan: __('In the'),
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
    // A Select DECLARED WITH NO OPTIONS renders a dropdown with an empty menu — a dead end, strictly
    // worse than a text box, because the condition cannot be expressed at all. Five such fields exist
    // in the live catalog today. The options are operator data and code does not invent them, so this
    // does not guess a list: it renders honestly what the declaration supports, and the field is
    // reported so the seed can be fixed. Once options are declared, this branch stops applying.
    if (!opts.length) return { type: 'text' }
    return { type: 'select', options: opts }
  }
  if (kind === 'number') return { type: 'number' }
  if (kind === 'date') return { iconLeft: '' }
  if (kind === 'link') return { doctype: field?.options || '', class: 'form-control' }
  if (kind === 'rating') return { max: Number(field?.options) || 5, class: '!flex' }
  if (kind === 'duration') return {}
  return { type: 'text' }
}

// ---- the conditions ARE the model ----------------------------------------------------------------
// There is no second copy. The rows this renders are the model's own condition objects, edited in place,
// which is the shape Insights' FilterRule/FiltersSelector use and the reason neither can flicker: a
// shadow array has to be pushed to the model and re-derived from it, and the two readings of one edit
// disagreed the moment either side normalised anything.
const rows = computed(() =>
  model.value && Array.isArray(model.value.conditions) ? model.value.conditions : [],
)

// A row is finished when the operator that needs a value has one. Reported, never silently dropped: a
// condition quietly discarded is a list that looks filtered and is not.
const incomplete = computed(() =>
  rows.value.filter((r) => valueKind(r) !== 'none' && (r.value === null || r.value === undefined || r.value === '')),
)
// The SAME three groups the automation builder offers, in its words, carrying the composer's own ops.
// `not` is "none of these hold", which `_predicate_where` reads as NOT(a OR b …) — one meaning, one place.
const joinerOptions = computed(() => [
  { label: __('All of'), value: 'and' },
  { label: __('Any of'), value: 'or' },
  { label: __('None of'), value: 'not' },
])
const joinerHint = computed(() =>
  joiner.value === 'or'
    ? __('at least one condition must hold')
    : joiner.value === 'not'
      ? __('no condition may hold')
      : __('every condition must hold'),
)
const valid = defineModel('valid', { type: Boolean, default: true })
watchEffect(() => (valid.value = incomplete.value.length === 0))

// Structure changes replace the array (add, remove); a field/operator/value change edits one row in place.
// The group's joiner, read off the model and defaulted exactly as the server defaults it
// (`_predicate_where`: `(node.get("op") or "and").lower()`), so an older saved predicate without one
// keeps meaning what it meant.
const joiner = computed(() => (model.value?.op || 'and').toLowerCase())

function setRows(next, op = joiner.value) {
  model.value = next.length ? { op, conditions: next } : null
}

// ONE joiner for the group, which is the tree the server reads: `op` + a flat `conditions` list. Only
// the second row carries the control — every later row displays the same word, because a group has one
// joiner, not one per row. Nested mixed groups are a different feature and a different shape.
function setJoiner(op) {
  if (op !== joiner.value) setRows(rows.value, op)
}
function blankValue(fieldname, operator) {
  return valueKind({ field: fieldname, operator }) === 'none' ? null : ''
}

function addRow() {
  const first = props.fields[0]
  if (!first) return
  const operator = defaultOperator(first.fieldname)
  setRows([
    ...rows.value,
    { field: first.fieldname, operator, value: blankValue(first.fieldname, operator) },
  ])
}
function removeRow(i) {
  setRows(rows.value.filter((_, j) => j !== i))
}
function onField(i, v) {
  const row = rows.value[i]
  row.field = v
  row.operator = defaultOperator(v)
  row.value = blankValue(v, row.operator)
}
function onOperator(i, v) {
  const row = rows.value[i]
  row.operator = v
  row.value = blankValue(row.field, v)
}
function onValue(i, v) {
  rows.value[i].value = v
}
</script>
