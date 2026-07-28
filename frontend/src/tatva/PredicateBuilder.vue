<!-- TATVA: the recursive predicate control. -->
<template>
  <div class="flex flex-col gap-2">
    <div
      v-if="!node"
      class="flex flex-wrap items-center gap-2"
    >
      <Button
        variant="subtle"
        iconLeft="plus"
        :label="__('Add condition')"
        :disabled="disabled || !fields.length"
        @click="seed('rule')"
      />
      <Button
        variant="ghost"
        iconLeft="plus"
        :label="__('Add group')"
        :disabled="disabled || !fields.length"
        @click="seed('all')"
      />
      <span v-if="!fields.length" class="text-xs text-ink-gray-4">
        {{
          subject
            ? __('No fields on {0} are enabled for automation yet.', [subject])
            : __('Choose a subject first.')
        }}
      </span>
    </div>

    <div v-else-if="node.type === 'rule'" class="flex flex-wrap items-center gap-2">
      <Autocomplete
        class="w-44"
        :modelValue="node.field"
        :options="fieldOptions"
        :placeholder="__('Field')"
        :disabled="disabled"
        @update:modelValue="(v) => onField(v?.value ?? null)"
      />
      <FormControl
        type="select"
        class="w-40"
        :modelValue="node.operator"
        :options="operatorOptions"
        :disabled="disabled"
        @update:modelValue="onOperator"
      />
      <component
        :is="FormControl"
        v-if="valueShape !== 'none'"
        class="w-44 flex-1"
        v-bind="valueProps"
        :modelValue="node.value"
        :disabled="disabled"
        @update:modelValue="(v) => patch({ value: v })"
      />
      <FormControl
        v-if="valueShape === 'range'"
        class="w-32"
        type="text"
        :placeholder="__('and')"
        :modelValue="node.from_value"
        :disabled="disabled"
        @update:modelValue="(v) => patch({ from_value: v })"
      />
      <div v-else-if="valueShape === 'none'" class="w-44 flex-1" />
      <Button
        variant="ghost"
        icon="x"
        :label="''"
        :disabled="disabled"
        @click="$emit('remove')"
      />
    </div>

    <div v-else class="rounded border border-outline-gray-2 bg-surface-gray-1 p-2.5">
      <div class="mb-2 flex items-center gap-2">
        <FormControl
          type="select"
          class="w-28"
          :modelValue="node.type"
          :options="groupOptions"
          :disabled="disabled"
          @update:modelValue="onGroupType"
        />
        <span class="text-xs text-ink-gray-5">{{ groupHint }}</span>
        <div class="flex-1" />
        <Button
          v-if="depth > 0"
          variant="ghost"
          icon="x"
          :label="''"
          :disabled="disabled"
          @click="$emit('remove')"
        />
      </div>

      <div class="flex flex-col gap-2 pl-2">
        <PredicateBuilder
          v-for="(child, i) in node.children"
          :key="i"
          :modelValue="child"
          :fields="fields"
          :operatorShapes="operatorShapes"
          :operatorsByType="operatorsByType"
          :subject="subject"
          :depth="depth + 1"
          :disabled="disabled"
          @update:modelValue="(v) => replaceChild(i, v)"
          @remove="removeChild(i)"
        />
      </div>

      <div v-if="node.type !== 'not' || !node.children.length" class="mt-2 flex gap-2 pl-2">
        <Button
          variant="ghost"
          iconLeft="plus"
          :label="__('Condition')"
          class="!text-ink-gray-6"
          :disabled="disabled"
          @click="addChild('rule')"
        />
        <Button
          v-if="node.type !== 'not'"
          variant="ghost"
          iconLeft="plus"
          :label="__('Group')"
          class="!text-ink-gray-6"
          :disabled="disabled"
          @click="addChild('all')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FormControl, Button, Autocomplete } from 'frappe-ui'
import { valueRows, groupedOptions, variableFor } from '@/tatva/valueOptions'

defineOptions({ name: 'PredicateBuilder' })

const props = defineProps({
  // From `node_context.variables`, shaped by `upstream._shaped`: [{ ref, label, type, source, source_label }].
  // `ref` is the identity — never `key`, which is `describe`'s word for a BARE field name and is what this
  // component wrongly indexed on until the suite beside it was written.
  fields: { type: Array, default: () => [] },
  // Also from builder_schema: { none: [...], range: [...], list: [...] } — which widget each operator needs.
  operatorShapes: { type: Object, default: () => ({}) },
  // From builder_schema too: which operators each FIELD TYPE offers. The contract resolves operators by
  // type, not per field — a per-field list would be a second vocabulary, and the field objects carry none.
  operatorsByType: { type: Object, default: () => ({}) },
  // Only so an empty catalog can say WHY it is empty; the author can act on one case, not the other.
  subject: { type: String, default: '' },
  depth: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['remove'])
const node = defineModel({ type: Object, default: null })

// Which operators take no value / a range / a list comes from the backend, never a copy here.
const shapes = computed(() => props.operatorShapes || {})
const NO_VALUE = computed(() => shapes.value.none || [])
const RANGE = computed(() => shapes.value.range || [])
const LIST = computed(() => shapes.value.list || [])

const groupOptions = [
  { label: __('All of'), value: 'all' },
  { label: __('Any of'), value: 'any' },
  { label: __('None of'), value: 'not' },
]
const groupHint = computed(() =>
  node.value?.type === 'all'
    ? __('every condition below must hold')
    : node.value?.type === 'any'
      ? __('at least one must hold')
      : __('the condition below must not hold'),
)

// Grouped by the source that produced each value, through the one grouper the inspector's own pickers
// use. Under the namespaced contract a flat list renders `crm_lead.status` and `api.status` as two rows
// both reading `Status`, and the author cannot tell which is which. Fields carrying no source (the
// automation rule form's builder_schema) group under '' and render exactly as they always did.
const fieldOptions = computed(() =>
  groupedOptions(valueRows(props.fields), node.value?.field),
)

const currentField = computed(() => variableFor(props.fields, node.value?.field))
const operatorOptions = computed(() => {
  const forType = props.operatorsByType[currentField.value?.type] || []
  return forType.map((o) => ({ label: __(o), value: o }))
})

const valueShape = computed(() => {
  const op = node.value?.operator
  if (NO_VALUE.value.includes(op)) return 'none'
  if (RANGE.value.includes(op)) return 'range'
  if (LIST.value.includes(op)) return 'list'
  return 'one'
})

const valueProps = computed(() => {
  const field = currentField.value
  if (valueShape.value === 'list') return { type: 'text', placeholder: __('Comma separated') }
  const options = field?.options
  if (Array.isArray(options)) {
    return { type: 'select', options: options.map((o) => ({ label: o, value: o })) }
  }
  if (['Int', 'Float', 'Currency', 'Percent'].includes(field?.type)) return { type: 'number' }
  if (field?.type === 'Date') return { type: 'date' }
  if (field?.type === 'Datetime') return { type: 'datetime-local' }
  return { type: 'text' }
})

// A fresh subtree is always valid, so switching type never leaves a half-shape behind.
function blank(type) {
  if (type === 'rule') {
    const first = props.fields[0]
    return {
      type: 'rule',
      field: first?.ref || '',
      operator: (props.operatorsByType[first?.type] || [])[0] || 'is',
      value: '',
    }
  }
  return { type, children: [] }
}

function seed(type) {
  node.value = blank(type)
}

function patch(changes) {
  node.value = { ...node.value, ...changes }
}

function onField(ref) {
  const field = variableFor(props.fields, ref)
  const first = (props.operatorsByType[field?.type] || [])[0] || 'is'
  patch({ field: ref, operator: first, value: '', from_value: undefined })
}

function onOperator(operator) {
  const changes = { operator }
  if (NO_VALUE.value.includes(operator)) changes.value = null
  if (!RANGE.value.includes(operator)) changes.from_value = undefined
  patch(changes)
}

// `not` holds exactly one child: narrowing keeps the first rather than emitting a shape the evaluator rejects.
function onGroupType(type) {
  const children = type === 'not' ? (node.value.children || []).slice(0, 1) : node.value.children || []
  node.value = { type, children }
}

function addChild(type) {
  node.value = { ...node.value, children: [...(node.value.children || []), blank(type)] }
}

function replaceChild(i, value) {
  const children = [...node.value.children]
  if (value == null) return removeChild(i)
  children[i] = value
  node.value = { ...node.value, children }
}

// An emptied group is removed; at the root, clearing to null is how an author says 'no condition'.
function removeChild(i) {
  const children = node.value.children.filter((_, j) => j !== i)
  node.value = children.length || props.depth > 0 ? { ...node.value, children } : null
}
</script>
