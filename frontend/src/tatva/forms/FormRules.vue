<!-- TATVA: Task Forms Rules tab — one card per rule (`ruleCards`), read in the form's question labels; edited, it writes the same rows Desk does. -->
<template>
  <div class="flex h-full flex-col gap-5.5">
    <div class="flex items-center gap-2">
      <p class="text-sm text-ink-gray-5">
        {{ __("Rules decide what shows, what's required and what's copied. Order only matters when two rules copy into the same question: the first wins.") }}
      </p>
      <FormControl
        v-model="search"
        type="text"
        class="ml-auto w-60"
        :placeholder="__('Search rules or questions')"
      >
        <template #prefix>
          <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
        </template>
      </FormControl>
      <Button v-if="editable" :label="__('Add rule')" iconLeft="plus" @click="addRule" />
    </div>
    <!-- The house empty state, as a lead's empty tab draws it: centred icon, title and line, full height. -->
    <div v-if="!shown.length" class="flex-1">
      <EmptyState
        v-if="cards.length"
        name="results"
        :title="__('No matches')"
        :description="__('No rule matches your search.')"
        :icon="LucideListChecks"
      />
      <EmptyState
        v-else
        name="Rules"
        :title="__('No Rules Found')"
        :description="__('Rules decide what shows, what is required and what is copied on this form.')"
        :icon="LucideListChecks"
      />
    </div>
    <div
      v-for="card in shown"
      ref="cardRefs"
      :key="keyOf(card)"
      class="flex flex-col gap-1.5 rounded bg-surface-gray-2 p-2.5"
    >
      <div class="flex h-7 items-center gap-2 text-base font-medium text-ink-gray-9">
        <FormControl
          v-if="editable"
          :modelValue="card.rows[0].rule_label"
          class="w-80"
          :placeholder="__('Rule name')"
          @update:modelValue="(v) => setWhen(card, 'rule_label', v)"
        />
        <span v-else>{{ card.rows[0].rule_label || __('When the form opens') }}</span>
        <Button
          v-if="editable"
          class="ml-auto"
          variant="ghost"
          icon="trash-2"
          :tooltip="__('Remove rule')"
          @click="removeRows(card, [...card.rows])"
        />
      </div>
      <div class="flex flex-col gap-1.5 rounded border border-dashed border-outline-gray-2 bg-surface-modal p-2 text-base text-ink-gray-8">
        <!-- WHEN: the row's two triplets, ANDed as the engine reads them. -->
        <div v-if="!editable" class="flex flex-wrap items-center gap-1.5">
          <span class="w-14 shrink-0 text-ink-gray-5">{{ __('When') }}</span>
          <span v-if="!triplets(card.rows[0]).length">{{ __('the form opens') }}</span>
          <template v-for="(t, i) in triplets(card.rows[0])" :key="i">
            <span v-if="i" class="text-ink-gray-5">{{ __('and') }}</span>
            <Badge variant="subtle" theme="gray" :label="labelOf(t.field)" />
            <span class="text-ink-gray-7">{{ __(t.operator || 'is') }}</span>
            <Badge v-if="arityOf(t.operator) !== 'none'" variant="subtle" theme="gray" :label="t.value" />
          </template>
        </div>
        <template v-else>
          <div v-for="slot in whenSlots(card)" :key="slot.suffix" class="flex items-center gap-2">
            <span class="w-14 shrink-0 text-ink-gray-5">{{ slot.suffix ? __('and') : __('When') }}</span>
            <!-- Searchable, as Add Field's picker is: a form can hold dozens of questions. -->
            <Autocomplete
              class="w-56"
              :options="questionOptions"
              :modelValue="card.rows[0]['condition_field' + slot.suffix]"
              :placeholder="__('Question')"
              @update:modelValue="(o) => setField(card, slot.suffix, valueOf(o))"
            />
            <FormControl
              type="select"
              class="w-32"
              :options="options.operator.map((o) => ({ label: __(o), value: o }))"
              :modelValue="card.rows[0]['operator' + slot.suffix] || options.operator[0]"
              @update:modelValue="(v) => setWhen(card, 'operator' + slot.suffix, v)"
            />
            <template v-if="arityOf(card.rows[0]['operator' + slot.suffix]) !== 'none'">
              <FormControl
                v-if="choicesOf(card.rows[0]['condition_field' + slot.suffix]).length"
                type="select"
                class="w-56"
                :options="choicesOf(card.rows[0]['condition_field' + slot.suffix])"
                :modelValue="card.rows[0]['condition_value' + slot.suffix]"
                @update:modelValue="(v) => setWhen(card, 'condition_value' + slot.suffix, v)"
              />
              <FormControl
                v-else
                class="w-56"
                :modelValue="card.rows[0]['condition_value' + slot.suffix]"
                @update:modelValue="(v) => setWhen(card, 'condition_value' + slot.suffix, v)"
              />
            </template>
            <!-- A select cannot offer a blank choice, so clearing is its own control; a first condition cleared is the opening state. -->
            <!-- Hidden, not removed, when there is nothing to clear, so both condition rows keep one width. -->
            <Button
              :class="{ invisible: !(slot.suffix || card.rows[0].condition_field) }"
              variant="ghost"
              icon="x"
              :tooltip="__('Remove condition')"
              @click="clearCondition(card, slot.suffix)"
            />
          </div>
          <!-- A rule row stores two conditions, so the offer goes once the second row is open. -->
          <div v-if="whenSlots(card).length < 2" class="flex gap-2">
            <span class="w-14 shrink-0" />
            <Button
              variant="ghost"
              :label="__('Add a second condition')"
              iconLeft="plus"
              @click="setWhen(card, 'operator_2', options.operator[0]); secondOpen.add(keyOf(card))"
            />
          </div>
        </template>
        <!-- THEN: ONE label and the rule's actions stacked beneath it, joined by a line, so a rule reads as one set. -->
        <div class="flex gap-2">
          <span class="w-14 shrink-0 pt-1 text-ink-gray-5">{{ __('Then') }}</span>
          <div class="flex min-w-0 flex-1 flex-col gap-1.5 border-l-2 border-outline-gray-2 pl-3">
            <div v-for="row in card.rows" :key="keyOf(row)" class="flex min-w-0 items-center gap-2">
              <div v-if="!editable" class="flex min-w-0 flex-wrap items-center gap-1.5">
                <!-- The verb in colour, so a card reads at a glance: what appears, what goes, what becomes required, what is copied. -->
                <Badge variant="subtle" :theme="ACTION_THEME[row.action] || 'gray'" :label="__(ACTION_LABEL[row.action] || row.action)" />
                <Badge v-for="t in targetsOf(row)" :key="t" variant="subtle" theme="gray" :label="labelOf(t)" />
                <template v-if="row.set_value">
                  <span class="text-ink-gray-5">{{ __('copied from') }}</span>
                  <Badge variant="subtle" theme="gray" :label="labelOf(row.set_value)" />
                </template>
              </div>
              <template v-else>
                <FormControl
                  v-model="row.action"
                  type="select"
                  class="w-40"
                  :options="options.action.map((a) => ({ label: __(a), value: a }))"
                />
                <MultiSelect
                  class="min-w-0 flex-1 basis-0"
                  :options="targetOptions"
                  :modelValue="targetsOf(row)"
                  :placeholder="__('Questions or sections')"
                  @update:modelValue="(v) => setTargets(row, v)"
                />
                <template v-if="row.action === 'Set Value'">
                  <span class="shrink-0 whitespace-nowrap text-base text-ink-gray-5">{{ __('copied from') }}</span>
                  <div class="w-56 shrink-0">
                    <Autocomplete
                      :options="questionOptions"
                      :modelValue="row.set_value"
                      :placeholder="__('Question')"
                      @update:modelValue="(o) => (row.set_value = valueOf(o))"
                    />
                  </div>
                </template>
                <Button variant="ghost" icon="x" :tooltip="__('Remove action')" @click="removeRows(card, [row])" />
              </template>
            </div>
            <Button
              v-if="editable"
              class="self-start"
              variant="ghost"
              :label="__('Add action')"
              iconLeft="plus"
              @click="addAction(card)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { WHEN, joinTargets } from './ruleCards'
import { isQuestion, choicesOf as choicesOfRow } from './formVocabulary'
import { arityOf } from '@/tatva/fieldControl'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import LucideListChecks from '~icons/lucide/list-checks'
import { Badge, Button, FeatherIcon, FormControl, MultiSelect } from 'frappe-ui'
import { computed, nextTick, reactive, ref } from 'vue'

// The rules grouped into cards ONCE by the page (`ruleCards.toCards`); editing changes these cards, never regroups them.
const cards = defineModel('cards', { type: Array, required: true })
const props = defineProps({
  // Every row the form declares, layout rows included, in order — what a rule may name.
  rows: { type: Array, required: true },
  // `builder_doc`'s targets, read by the server's `rule_targets` — never split here.
  targets: { type: Object, required: true },
  // The rule doctype's own operator and action options.
  options: { type: Object, required: true },
  editable: { type: Boolean, default: false },
})

const search = ref('')
const labels = computed(() => new Map(props.rows.map((r) => [r.fieldname, r.label || r.fieldname])))
const labelOf = (fieldname) => labels.value.get(fieldname) || fieldname

// A WHEN field and a Copy-from source are questions; a target may also be a whole section or tab.
const questionOptions = computed(() =>
  props.rows.filter(isQuestion).map((r) => ({ label: r.label || r.fieldname, value: r.fieldname })),
)
// The picker hands back an option; a row stores its value.
const valueOf = (o) => (o && typeof o === 'object' ? o.value : o) || ''
const targetOptions = computed(() =>
  props.rows.filter((r) => r.fieldname).map((r) => ({ label: r.label || r.fieldname, value: r.fieldname })),
)
const choicesOf = (fieldname) => choicesOfRow(props.rows.find((r) => r.fieldname === fieldname))

// Stable keys for cards and rows that have no `name` yet, so nothing remounts while it is being edited.
const keys = new WeakMap()
let next = 0
const keyOf = (row) => {
  if (!keys.has(row)) keys.set(row, `rule-${next++}`)
  return keys.get(row)
}

// Targets as chips: the server's split for a saved row, then whatever the author picks, written back as Desk writes it.
const picked = reactive(new Map())
function targetsOf(row) {
  if (picked.has(row)) return picked.get(row)
  return (row.name && props.targets[row.name]) || []
}
function setTargets(row, list) {
  picked.set(row, list)
  row.targets = joinTargets(list)
}

const shown = computed(() => {
  const needle = search.value.trim().toLowerCase()
  const all = cards.value
  if (!needle) return all
  const names = (r) => [r.condition_field, r.condition_field_2, r.set_value, ...targetsOf(r)].filter(Boolean)
  return all.filter((card) =>
    card.rows.some(
      (r) =>
        (r.rule_label || '').toLowerCase().includes(needle) ||
        names(r).some((f) => labelOf(f).toLowerCase().includes(needle)),
    ),
  )
})

// A card's name and WHEN live on every row of its run, so an edit rewrites them all and the run stays one card.
function setWhen(card, key, value) {
  for (const row of card.rows) row[key] = value
}
// A new question empties the value, which belonged to the old question's choices.
function setField(card, suffix, fieldname) {
  setWhen(card, 'condition_field' + suffix, fieldname)
  setWhen(card, 'condition_value' + suffix, '')
}
const secondOpen = reactive(new Set())
const whenSlots = (card) =>
  card.rows[0].condition_field_2 || secondOpen.has(keyOf(card))
    ? [{ suffix: '' }, { suffix: '_2' }]
    : [{ suffix: '' }]
function clearCondition(card, suffix) {
  for (const key of ['condition_field', 'operator', 'condition_value']) setWhen(card, key + suffix, '')
  if (suffix) secondOpen.delete(keyOf(card))
}

// A new action carries its card's name and WHEN, and nothing else, onto the end of that card.
function addAction(card) {
  const first = card.rows[0]
  card.rows.push(reactive({ ...Object.fromEntries(WHEN.map((k) => [k, first[k] || ''])), action: props.options.action[0], targets: '' }))
}
// The rule cards on screen, so a new one is brought into view as FieldLayoutEditor brings a new tab.
const cardRefs = ref([])
// Named apart from every other rule, or an unnamed new rule beside an unnamed one would read as the same rule.
function addRule() {
  const taken = new Set(cards.value.map((c) => c.rows[0].rule_label))
  let n = cards.value.length + 1
  while (taken.has(__('Rule {0}', [n]))) n++
  cards.value.push(
    reactive({ rows: [{ rule_label: __('Rule {0}', [n]), operator: props.options.operator[0], action: props.options.action[0], targets: '' }] }),
  )
  nextTick(() => cardRefs.value.at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
}
// A card with no action left is no rule at all, so it goes with its last row.
function removeRows(card, rows) {
  for (const row of rows) card.rows.splice(card.rows.indexOf(row), 1)
  if (!card.rows.length) cards.value.splice(cards.value.indexOf(card), 1)
}

// View mode: the row's two triplets, ANDed as the engine reads them; none is the form's opening state.
const triplets = (row) =>
  [
    { field: row.condition_field, operator: row.operator, value: row.condition_value },
    { field: row.condition_field_2, operator: row.operator_2, value: row.condition_value_2 },
  ].filter((t) => t.field)

// Badge themes are frappe-ui's own vocabulary; the verbs read as the rule doctype names them, Make Mandatory as "Make required".
const ACTION_THEME = { Show: 'green', Hide: 'red', 'Make Mandatory': 'orange', 'Set Value': 'blue' }
const ACTION_LABEL = { 'Make Mandatory': 'Make required' }
</script>
