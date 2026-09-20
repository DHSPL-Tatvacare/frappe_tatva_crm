<!--
  TATVA: PredicateCondition — the MOLECULE. One leaf: a field, an operator, a value, a way to remove it.

  It owns the ROW, never the vocabulary. Which fields exist, which operators a field offers and which
  widget a value needs all arrive through the shared context the root provides, and the VALUE CONTROL
  itself is the host's to render — that slot is the seam that lets one control serve a smart view, a form
  rule and a workflow branch without any of them leaking in here.
-->
<template>
  <div
    class="flex flex-col gap-2 rounded-md border border-outline-gray-1 bg-surface-white p-2 sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto] sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
  >
    <Autocomplete
      class="min-w-0"
      :modelValue="node.field"
      :options="fieldOptions"
      :placeholder="__('Field')"
      :disabled="c.disabled"
      @update:modelValue="(v) => onField(v?.value ?? null)"
    />

    <FormControl
      type="select"
      class="min-w-0"
      :modelValue="node.operator"
      :options="operatorOptions"
      :disabled="c.disabled"
      @update:modelValue="onOperator"
    />

    <!-- The host renders the value. Everything it needs is handed to it; nothing about its choice of
         control comes back in here. `needsValue` false means the operator takes none (is set / is empty),
         and the cell is held open so the grid keeps its columns. -->
    <div v-if="needsValue" class="min-w-0">
      <slot
        name="value"
        :node="node"
        :field="field"
        :shape="shape"
        :invalid="invalid"
        :patch="onPatch"
      />
    </div>
    <div v-else />

    <Button
      class="self-end sm:self-auto"
      variant="ghost"
      icon="x"
      :label="''"
      :disabled="c.disabled"
      @click="emit('remove')"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { FormControl, Button } from 'frappe-ui'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { groupedOptions } from '@/tatva/valueOptions'
import { PREDICATE_CONTEXT } from './context'

defineOptions({ name: 'PredicateCondition' })

const props = defineProps({
  node: { type: Object, required: true },
  invalid: { type: Boolean, default: false },
})
const emit = defineEmits(['update:node', 'remove'])

const ctx = inject(PREDICATE_CONTEXT)
const c = computed(() => ctx.value)

// Grouped by section through the one grouper the workflow pickers use, so each section lists its own matches.
const fieldOptions = computed(() =>
  groupedOptions((c.value.fields || []).map((f) => ({ label: f.label || f.key, value: f.key, group: f.group || '' }))),
)
const field = computed(() => (c.value.fields || []).find((f) => f.key === props.node.field) || null)

const operatorOptions = computed(() => c.value.operatorsFor(field.value))
// `none` | `range` | `list` | `one` — which widget the operator needs, decided by the host's shapes.
const shape = computed(() => c.value.shapeOf(props.node.operator))
const needsValue = computed(() => shape.value !== 'none')

function onField(key) {
  if (!key) return
  const next = c.value.operatorsFor((c.value.fields || []).find((f) => f.key === key))[0]?.value
  // A new field can make the old operator meaningless, so the operator and the value are re-seeded with
  // it rather than left behind to fail at save.
  emit('update:node', { ...props.node, field: key, operator: next, value: blankFor(next), from_value: undefined })
}
function onOperator(operator) {
  // A new operator can make the old value meaningless — and a range that is no longer a range must drop
  // its second end, or a stale `from_value` rides along into the saved tree.
  emit('update:node', { ...props.node, operator, value: blankFor(operator), from_value: undefined })
}

function blankFor(operator) {
  return c.value.shapeOf(operator) === 'none' ? null : ''
}
function onPatch(changes) {
  emit('update:node', { ...props.node, ...changes })
}
</script>
