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
      <FieldPicker
        class="w-44 min-w-0"
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
      <!-- One control per value the operator stores, every one drawn by the SAME resolver: the second box read `text` whatever the field was, so a date range had a picker at one end and a typing box at the other. -->
      <template v-for="(key, i) in valueKeys" :key="key">
        <!-- A Link field picks through the app's Link control, so the composite key is what gets stored. -->
        <Link
          v-if="valueProps.control === 'link'"
          class="w-44 min-w-0 flex-1"
          :doctype="valueProps.doctype"
          :query="valueProps.query"
          :filters="valueProps.filters"
          :multiple="isList"
          :value="isList ? listValue : node[key]"
          :placeholder="i ? __('and') : isList ? __('Choose values') : __('Choose one')"
          :disabled="disabled"
          @change="(v) => (isList ? patchList(v) : patch({ [key]: v }))"
        />
        <!-- A declared option set is ticked from its list, never typed. -->
        <Autocomplete
          v-else-if="valueProps.control === 'multi'"
          class="w-44 min-w-0 flex-1"
          :options="valueProps.options"
          :modelValue="listValue"
          multiple
          :placeholder="__('Choose values')"
          :disabled="disabled"
          @update:modelValue="(v) => patchList(v.map((o) => (o && typeof o === 'object' ? o.value : o)))"
        />
        <component
          :is="FormControl"
          v-else
          class="w-44 min-w-0 flex-1"
          v-bind="valueProps"
          :placeholder="i ? __('and') : valueProps.placeholder"
          :modelValue="node[key]"
          :disabled="disabled"
          @update:modelValue="(v) => patch({ [key]: v })"
        />
      </template>
      <div v-if="!valueKeys.length" class="w-44 flex-1" />
      <Button
        variant="ghost"
        icon="x"
        :label="''"
        :disabled="disabled"
        data-test="predicate-remove"
        @click="dismiss()"
      />
      <!-- A chosen value the engine cannot read back as one value, named where it was chosen. -->
      <div
        v-if="listProblems.length"
        class="basis-full text-xs text-ink-red-3"
        data-test="predicate-unexpressable"
      >
        {{
          __('{0} contains a comma, which separates values here — this condition cannot match it.', [
            listProblems.join(__(' and ')),
          ])
        }}
      </div>
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
          variant="ghost"
          icon="x"
          :label="''"
          :disabled="disabled"
          data-test="predicate-remove"
          @click="dismiss()"
        />
      </div>

      <div class="flex flex-col gap-2 pl-2">
        <PredicateBuilder
          v-for="(child, i) in node.children"
          :key="i"
          :modelValue="child"
          :fields="fields"
          :allFields="allFields"
          :operatorShapes="operatorShapes"
          :operatorsByType="operatorsByType"
          :subject="subject"
          :depth="depth + 1"
          :disabled="disabled"
          @update:modelValue="(v) => replaceChild(i, v)"
          @remove="removeChild(i)"
        />
      </div>

      <!-- Gated like the empty state above: with no fields, `blank` mints a rule with no field and a group with no children, and `_walk_predicate` refuses both at save. -->
      <div v-if="node.type !== 'not' || !node.children.length" class="mt-2 flex gap-2 pl-2">
        <Button
          variant="ghost"
          iconLeft="plus"
          :label="__('Condition')"
          class="!text-ink-gray-6"
          :disabled="disabled || !fields.length"
          @click="addChild('rule')"
        />
        <Button
          v-if="node.type !== 'not'"
          variant="ghost"
          iconLeft="plus"
          :label="__('Group')"
          class="!text-ink-gray-6"
          :disabled="disabled || !fields.length"
          @click="addChild('all')"
        />
        <span v-if="!fields.length" class="self-center text-xs text-ink-gray-4">
          {{
            subject
              ? __('No fields on {0} are enabled for automation yet.', [subject])
              : __('Choose a subject first.')
          }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { FormControl, Button } from 'frappe-ui'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import FieldPicker from '@/tatva/FieldPicker.vue'
import Link from '@/components/Controls/Link.vue'
import { valueRows, groupedOptions, variableFor, controlFor } from '@/tatva/valueOptions'
import { splitItems, joinItems, unexpressable } from '@/tatva/predicateList'

defineOptions({ name: 'PredicateBuilder' })

const props = defineProps({
  // `node_context.variables` rows `{ ref, label, type, source, source_label }`; `ref` is the identity, never `key`.
  fields: { type: Array, default: () => [] },
  // The same list before the Trigger's working set narrowed it; empty means nothing was hidden.
  allFields: { type: Array, default: () => [] },
  // Also from builder_schema: { none: [...], range: [...], list: [...] } — which widget each operator needs.
  operatorShapes: { type: Object, default: () => ({}) },
  // From builder_schema: the operators each field TYPE offers (never per field).
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

// `activeFields` is what is offered; resolution always reads the full list, so a condition on a field outside the working set keeps its type and widget.
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

function shapeOf(op) {
  if (NO_VALUE.value.includes(op)) return 'none'
  if (RANGE.value.includes(op)) return 'range'
  if (LIST.value.includes(op)) return 'list'
  return 'one'
}
const valueShape = computed(() => shapeOf(node.value?.operator))

// The stored values an operator fills, first box first — `from_value` is the FIRST end both `_between` and `changed from…to` read — asked of an OPERATOR so the render and `onOperator`'s clearing stay one rule.
const keysFor = (op) => (shapeOf(op) === 'none' ? [] : shapeOf(op) === 'range' ? ['from_value', 'value'] : ['value'])
const valueKeys = computed(() => keysFor(node.value?.operator))

// Several values, or one — read off the operator, never off the field.
const isList = computed(() => valueShape.value === 'list')

// Several values with nothing to pick from: room to read them, and one per line rather than one long row.
const freeList = () => ({ type: 'textarea', rows: 3, placeholder: __('One value per line') })

// THE one control resolver, the same one a Field Map row asks — a ladder here read a Link's target as options.
const valueProps = computed(() => {
  // Where values come from is the FIELD's; how many may be picked is the OPERATOR's — read separately.
  const { control, options, doctype, query, filters } = controlFor(currentField.value)
  if (control === 'link') return { control, doctype, query, filters }
  if (control === 'select') {
    // A declared option set is ticked, never typed; the descriptor unions every form's choices.
    return isList.value
      ? { control: 'multi', options }
      : { type: 'select', options }
  }
  // Nothing below offers values: several of them are typed one per line, since a number box holds one.
  if (isList.value) return freeList()
  if (control === 'datetime') return { type: 'datetime-local' }
  if (control === 'data') return { type: 'text' }
  return { type: control }
})

// The engine reads the stored string and the control works in values; `predicateList` is the one converter.
const listValue = computed(() => splitItems(node.value?.value))

// A value the engine cannot read back as one value — surfaced where it is chosen, never saved silently.
const listProblems = computed(() => (isList.value ? unexpressable(listValue.value) : []))

function patchList(values) {
  patch({ value: joinItems(values) })
}

// A fresh subtree is always valid, so switching type never leaves a half-shape behind.
function blank(type) {
  if (type === 'rule') {
    // A new condition starts on an offered field, not on anything that exists.
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
  // Resolved against the full list, so a field picked through the escape hatch keeps its real operators.
  const field = variableFor(resolvableFields.value, ref)
  const first = (props.operatorsByType[field?.type] || [])[0] || 'is'
  patch({ field: ref, operator: first, value: '', from_value: undefined })
}

function onOperator(operator) {
  const keys = keysFor(operator)
  const changes = { operator }
  if (!keys.length) changes.value = null
  if (!keys.includes('from_value')) changes.from_value = undefined
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

// The X, wherever it sits: a nested part is removed by its PARENT, the root has none so it clears to the same null `seed` starts from.
function dismiss() {
  if (props.depth > 0) return emit('remove')
  node.value = null
}

// An emptied group is removed; at the root, clearing to null is how an author says 'no condition'.
function removeChild(i) {
  const children = node.value.children.filter((_, j) => j !== i)
  node.value = children.length || props.depth > 0 ? { ...node.value, children } : null
}
</script>
