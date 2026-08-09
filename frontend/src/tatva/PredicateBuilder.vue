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
      <!-- The app's own Link control when the field being tested is a Link, so the author picks
           `Courtesy Visit` and the composite key is what gets stored. -->
      <Link
        v-if="valueShape !== 'none' && valueProps.control === 'link'"
        class="w-44 flex-1"
        :doctype="valueProps.doctype"
        :value="node.value"
        :placeholder="__('Choose one')"
        :disabled="disabled"
        @change="(v) => patch({ value: v })"
      />
      <component
        :is="FormControl"
        v-else-if="valueShape !== 'none'"
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
      <!-- W3.1 rule 4 — only while the working set is actually hiding something from this control. -->
      <button
        v-if="hiddenCount"
        type="button"
        class="basis-full text-left text-xs text-ink-blue-3 hover:underline"
        @click="showAll = !showAll"
      >
        {{
          showAll
            ? __('Show only the fields this workflow uses')
            : __('Show all fields ({0} more)', [hiddenCount])
        }}
      </button>
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
import { computed, ref } from 'vue'
import { FormControl, Button, Autocomplete } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import { valueRows, groupedOptions, variableFor, controlFor } from '@/tatva/valueOptions'

defineOptions({ name: 'PredicateBuilder' })

const props = defineProps({
  // From `node_context.variables`, shaped by `upstream._shaped`: [{ ref, label, type, source, source_label }].
  // `ref` is the identity — never `key`, which is `describe`'s word for a BARE field name and is what this
  // component wrongly indexed on until the suite beside it was written.
  fields: { type: Array, default: () => [] },
  // W3.1 — the same list before the Trigger's working set narrowed it, so this control can offer rule 4's
  // escape hatch without re-deriving the narrowing. Defaults to empty, which means "nothing was hidden"
  // and leaves every existing caller rendering exactly as it does today.
  allFields: { type: Array, default: () => [] },
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
defineEmits(['remove'])
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
// W3.1 rule 4 — the narrowing is never a wall. `activeFields` is the offer; `allFields` is what the
// author can fall back to. Resolution ALWAYS reads the full list, so a condition already built on a
// field outside the working set keeps its type, its operators and its widget (rule 3) whether or not
// the escape hatch is open — a narrowing must never silently break an existing workflow.
const showAll = ref(false)
const activeFields = computed(() => (showAll.value ? resolvableFields.value : props.fields))
const resolvableFields = computed(() =>
  props.allFields.length ? props.allFields : props.fields,
)
const hiddenCount = computed(() =>
  Math.max(0, resolvableFields.value.length - props.fields.length),
)

const fieldOptions = computed(() =>
  groupedOptions(
    valueRows(activeFields.value),
    node.value?.field,
    valueRows(resolvableFields.value),
  ),
)

const currentField = computed(() => variableFor(resolvableFields.value, node.value?.field))
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

// THE one control resolver, the same one a Field Map row asks — a ladder here read a Link's target as options.
const valueProps = computed(() => {
  if (valueShape.value === 'list') return { type: 'text', placeholder: __('Comma separated') }
  const { control, options, doctype } = controlFor(currentField.value)
  if (control === 'link') return { control, doctype }
  if (control === 'select') return { type: 'select', options }
  if (control === 'datetime') return { type: 'datetime-local' }
  if (control === 'data') return { type: 'text' }
  return { type: control }
})

// A fresh subtree is always valid, so switching type never leaves a half-shape behind.
function blank(type) {
  if (type === 'rule') {
    // Seeded from what is OFFERED, not from everything that exists: a new condition should start on a
    // field this workflow says it works with.
    const first = activeFields.value[0]
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
  // Resolved against the full list: while the escape hatch is open the author can pick a field the
  // working set does not name, and its operators must still come from its real type.
  const field = variableFor(resolvableFields.value, ref)
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
