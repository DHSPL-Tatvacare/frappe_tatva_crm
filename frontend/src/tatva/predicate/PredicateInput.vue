<!--
  TATVA: PredicateInput — THE predicate control. One component, every surface that has conditions.

  It is the ROOT of the family (PredicateGroup · PredicateCondition · PredicateJoiner) and is shaped the
  way frappe-ui shapes ListView: the root owns the model and PROVIDES the shared context, the children
  INJECT it, and the logic lives beside them in `predicateTree.js` rather than inside whichever component
  happened to need it first.

  WHAT IT OWNS            structure — groups, nesting, rows, add/remove, the joiner, validity.
  WHAT THE HOST SUPPLIES  its own vocabulary: the fields, which operators each field type offers, which
                          operators need no value / a range / a list, and the words for and/or/not.
  WHAT IT NEVER KNOWS     smart views, workflows, forms, doctypes, endpoints.

  THE VALUE CONTROL IS THE HOST'S, through the `value` slot. That single seam is why one control can
  serve a smart view (frappe date pickers and Link fields over a catalog), a form rule and a workflow
  branch (its own variable pickers) without any of them leaking in here — and it is exactly the coupling
  that kept the two builders in this app apart.

      <PredicateInput v-model="predicate" v-model:valid="valid" :fields="fields"
                      :operators-by-type="ops" :shapes="shapes" :max-depth="1">
        <template #value="{ node, field, shape, invalid, update }"> … </template>
      </PredicateInput>
-->
<template>
  <div class="flex min-h-0 flex-col">
    <PredicateGroup v-if="root" v-model="root" :depth="0">
      <template #value="slotProps"><slot name="value" v-bind="slotProps" /></template>
    </PredicateGroup>

    <!-- Nothing yet is a state, not an empty box: one control that starts the tree, so the first
         condition costs the same click as every one after it. -->
    <div v-else>
      <Button
        variant="ghost"
        iconLeft="plus"
        class="!text-ink-gray-6"
        :label="__('Add condition')"
        :disabled="disabled || !fields.length"
        @click="start"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, provide, watchEffect } from 'vue'
import { Button } from 'frappe-ui'
import PredicateGroup from './PredicateGroup.vue'
import { PREDICATE_CONTEXT } from './context'
import { emptyGroup, leaf, leaves, prune, isGroup } from './predicateTree'

defineOptions({ name: 'PredicateInput' })

const props = defineProps({
  // [{ key, label, type, group? }] — `key` is the identity the predicate stores, `type` is what resolves
  // operators and the value widget. Deliberately not a doctype fieldname: a host may key by anything.
  fields: { type: Array, default: () => [] },
  // { [type]: [{ label, value }] } — the host's operator vocabulary, per field type.
  operatorsByType: { type: Object, default: () => ({}) },
  // { none: [], range: [], list: [] } — which operators need which widget. Anything unlisted takes one value.
  shapes: { type: Object, default: () => ({}) },
  // [{ label, value }] for and/or/not. Defaulted to plain words so a host can ignore it.
  joinerOptions: {
    type: Array,
    default: () => [
      { label: __('All of'), value: 'and' },
      { label: __('Any of'), value: 'or' },
      { label: __('None of'), value: 'not' },
    ],
  },
  // 1 = flat (no "Add group"). Raise it when the host can store a nested tree.
  maxDepth: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
})

const model = defineModel({ type: Object, default: null })
// Reported, never silently corrected: a host decides whether an unfinished condition blocks its save.
const valid = defineModel('valid', { type: Boolean, default: true })

// The root is always a GROUP. A model that arrives as a bare leaf (or as null) is normalised here so
// every child below can assume the shape, and an empty one is emitted back as null rather than as a
// group with nothing in it — "no predicate" is the honest thing to save.
const root = computed({
  get: () => (isGroup(model.value) ? model.value : null),
  set: (v) => (model.value = prune(v)),
})

function operatorsFor(field) {
  return props.operatorsByType[field?.type] || props.operatorsByType.default || []
}
function shapeOf(operator) {
  for (const shape of ['none', 'range', 'list']) {
    if ((props.shapes[shape] || []).includes(operator)) return shape
  }
  return 'one'
}
function blankValue(operator) {
  return shapeOf(operator) === 'none' ? null : ''
}
function blankLeaf() {
  const first = props.fields[0]
  const operator = operatorsFor(first)[0]?.value || ''
  return leaf(first?.key ?? null, operator, blankValue(operator))
}
// A range needs BOTH ends before it is finished; anything else needs its one value.
function isIncompleteValue(node) {
  const shape = shapeOf(node.operator)
  if (shape === 'none') return false
  const empty = (v) => v === null || v === undefined || v === ''
  return shape === 'range' ? empty(node.from_value) || empty(node.value) : empty(node.value)
}
// The one definition of "unfinished", so the row marker and the host's save gate can never disagree.
function isIncomplete(node) {
  return isIncompleteValue(node)
}

const incomplete = computed(() => leaves(root.value).filter(({ node }) => isIncomplete(node)))
watchEffect(() => (valid.value = incomplete.value.length === 0))

function start() {
  root.value = { ...emptyGroup('and'), conditions: [blankLeaf()] }
}

// ONE computed, the shape ListView provides (`provide('list', computed(() => ({…})))`). Handing over a
// plain object froze `disabled` and `maxDepth` at setup — a host could disable this control and the rows
// below would never hear about it.
provide(
  PREDICATE_CONTEXT,
  computed(() => ({
    fields: props.fields,
    joinerOptions: props.joinerOptions,
    maxDepth: props.maxDepth,
    disabled: props.disabled,
    operatorsFor,
    shapeOf,
    blankLeaf,
    isIncomplete,
    hintFor: (op) => HINTS[op] || HINTS.and,
  })),
)

const HINTS = {
  and: __('every condition must hold'),
  or: __('at least one condition must hold'),
  not: __('no condition may hold'),
}
</script>
