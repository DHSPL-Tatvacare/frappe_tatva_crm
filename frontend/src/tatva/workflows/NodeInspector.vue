<!-- TATVA: node inspector (right panel). -->
<template>
  <aside class="flex w-72 shrink-0 flex-col border-l border-outline-gray-2 bg-surface-white">
    <header class="border-b border-outline-gray-2">
      <div class="flex items-center gap-2 px-4 py-2" :class="category.bar">
        <span
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded"
          :class="category.chip"
        >
          <component :is="iconFor(node.node_type)" class="h-3 w-3" />
        </span>
        <span
          class="text-[10px] font-semibold uppercase tracking-wider"
          :class="category.text"
        >
          {{ __(category.label) }}
        </span>
        <div class="flex-1" />
        <Button
          v-if="editable"
          variant="ghost"
          theme="red"
          icon="trash-2"
          :label="''"
          @click="confirmDelete"
        />
        <Button variant="ghost" icon="x" :label="''" @click="$emit('close')" />
      </div>

      <div class="px-4 pb-3 pt-2.5">
        <p class="truncate text-sm font-semibold text-ink-gray-8">{{ title }}</p>
        <p v-if="declaration?.description" class="mt-0.5 text-xs leading-snug text-ink-gray-6">
          {{ __(declaration.description) }}
        </p>
        <p class="mt-1.5 truncate font-mono text-[10px] text-ink-gray-4">{{ node.node_id }}</p>
      </div>
    </header>

    <div class="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
      <div v-for="f in visibleFields" :key="f.name">
        <div
          v-if="COMPOSITE.includes(f.type)"
          class="mb-1 text-xs font-medium text-ink-gray-6"
        >
          {{ __(f.label) }}
          <span v-if="f.reqd" class="text-ink-red-2">*</span>
        </div>

        <PredicateBuilder
          v-if="f.type === 'Predicate'"
          :modelValue="config[f.name] || null"
          :fields="predicateFields"
          :operatorShapes="operatorShapes"
          :operatorsByType="operatorsByType"
          :subject="subjectDoctype"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <ResponseMapping
          v-else-if="f.type === 'Mapping'"
          :modelValue="config[f.name] || []"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <RequirementList
          v-else-if="f.type === 'Requirements'"
          :modelValue="config[f.name] || []"
          :verbs="f.verbs || []"
          :fields="predicateFields"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <FormControl
          v-else-if="GRAPH_TYPES.includes(f.type)"
          type="select"
          :label="__(f.label)"
          :options="graphOptions(f)"
          :modelValue="config[f.name]"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <Link
          v-else-if="LINK_TYPES.includes(f.type)"
          :label="__(f.label)"
          :doctype="f.link"
          :filters="linkFilters(f)"
          :value="config[f.name] || ''"
          :placeholder="f.type === 'Grain' ? __('Any') : __('Select option')"
          :disabled="!editable"
          @change="(v) => setConfig(f.name, v)"
        />

        <FormControl
          v-else-if="f.type === 'Select'"
          type="select"
          :label="__(f.label)"
          :options="selectOptions(f)"
          :modelValue="config[f.name]"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <FormControl
          v-else-if="TEXTAREA_TYPES.includes(f.type)"
          type="textarea"
          :label="__(f.label)"
          :rows="3"
          :modelValue="config[f.name]"
          :disabled="!editable"
          :placeholder="f.placeholder || ''"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <div v-else-if="PICKED_TYPES.includes(f.type)">
          <div class="mb-1 text-xs font-medium text-ink-gray-6">
            {{ __(f.label) }}
            <span v-if="f.reqd" class="text-ink-red-2">*</span>
          </div>
          <Autocomplete
            :modelValue="config[f.name]"
            :options="pickOptions(f)"
            :placeholder="pickPlaceholder(f)"
            :disabled="!editable"
            @update:modelValue="(v) => setConfig(f.name, v?.value ?? null)"
          />
          <FormControl
            v-if="f.free_text"
            type="text"
            class="mt-1"
            :placeholder="__('…or type a literal value')"
            :modelValue="config[f.name]"
            :disabled="!editable"
            @update:modelValue="(v) => setConfig(f.name, v)"
          />
          <p v-if="!pickRows(f).length" class="mt-1 text-xs text-ink-gray-4">
            {{ pickEmpty(f) }}
          </p>
        </div>

        <FormControl
          v-else-if="f.type === 'Int'"
          type="number"
          :label="__(f.label)"
          :modelValue="config[f.name]"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <FormControl
          v-else
          type="text"
          :label="__(f.label)"
          :modelValue="config[f.name]"
          :disabled="!editable"
          :placeholder="f.placeholder || ''"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />
      </div>

      <p v-if="!visibleFields.length" class="pt-1 text-xs leading-snug text-ink-gray-4">
        {{ __('This node type has no settings. Connect its handles on the canvas.') }}
      </p>
    </div>
  </aside>
</template>

<script setup>
import { computed, watch } from 'vue'
import { FormControl, Button, Autocomplete, createResource } from 'frappe-ui'
import PredicateBuilder from '@/tatva/PredicateBuilder.vue'
import RequirementList from '@/tatva/RequirementList.vue'
import ResponseMapping from '@/tatva/ResponseMapping.vue'
import Link from '@/components/Controls/Link.vue'
import { useNodeTypes } from '@/tatva/useNodeTypes'
import { createDialog } from '@/utils/dialogs'
import { categoryFor, iconFor } from './nodeCatalog'
import { configOf } from './graphMap'
import { valueRows, fieldRows, groupedOptions } from '@/tatva/valueOptions'

const props = defineProps({
  node: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  // Every node on the canvas, so a Wait can offer the nodes it may wait on and their outcomes.
  graph: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'shape-change', 'delete'])

const { declarationFor, configFieldsFor } = useNodeTypes()

const declaration = computed(() => declarationFor(props.node.node_type))
const category = computed(() => categoryFor(props.node.node_type))
// The node type's own label — the same title the card shows, so the panel and the box always agree.
const title = computed(() => __(declaration.value?.label || props.node.node_type || 'Node'))

// The node stores its settings as JSON text; the inspector edits an object and writes it back. Guarded
// so a malformed value renders an empty panel rather than throwing on the render path (§12).
const config = computed(() => configOf(props.node))

// Only the fields this type declares, minus any whose gate is shut.
const visibleFields = computed(() =>
  configFieldsFor(props.node.node_type).filter((f) => applies(f, config.value)),
)

// Controls that are not FormControls, so they carry no `label` prop and need a heading rendered above.
const COMPOSITE = ['Predicate', 'Requirements', 'Mapping']
// Values that are PICKED, never typed. `Variable` offers whatever is readable at this node — the same
// list the predicate control uses, so a variable reads identically wherever it appears. `Field` offers
// what automation is allowed to WRITE on the subject, which the builder contract already scopes.
const PICKED_TYPES = ['Variable', 'Field']
// A verb parameter declares its target doctype in `link`, exactly as a Grain axis does — one control.
const LINK_TYPES = ['Grain', 'Link']
// Choices these types offer come from the GRAPH, not the registry.
const GRAPH_TYPES = ['Node', 'Outcome', 'Target']
const TEXTAREA_TYPES = ['Code', 'Small Text', 'Text', 'Long Text']

// A field gated on another's value hides while that gate is shut — the backend rule, applied here.
function applies(field, current) {
  const gate = field.depends_on_value
  if (!gate) return true
  return Object.entries(gate).every(([name, values]) =>
    (Array.isArray(values) ? values : [values]).includes(current[name]),
  )
}

// Only a node that can EMIT may be waited on; anything else builds a wait nothing satisfies.
const emitters = computed(() =>
  props.graph.filter((n) => n.node_id !== props.node.node_id && (declarationFor(n.node_type)?.outcomes || []).length),
)

function graphOptions(field) {
  // The records a write may target: the lead, and the doc that fired the run. Real doctype NAMES,
  // because that is what the handler compares against — a friendly label here would never match.
  if (field.type === 'Target') {
    const targets = ['CRM Lead']
    if (subjectDoctype.value && !targets.includes(subjectDoctype.value)) targets.push(subjectDoctype.value)
    return targets.map((t) => ({ label: t, value: t }))
  }
  if (field.type === 'Node') {
    return emitters.value.map((n) => ({ label: `${n.node_id} · ${__(n.node_type)}`, value: n.node_id }))
  }
  const source = emitters.value.find((n) => n.node_id === config.value.source_node)
  return (declarationFor(source?.node_type)?.outcomes || []).map((o) => ({ label: o, value: o }))
}

// Rows for THIS control: a `Field` picks a write target, anything else picks a value to read. Two
// questions, two brains, one row shape — grouped and rendered identically from there on.
function pickRows(field) {
  return field.type === 'Field' ? fieldRows(settableFields.value) : valueRows(predicateFields.value)
}

function pickOptions(field) {
  return groupedOptions(pickRows(field), config.value[field.name])
}

// A picker drawing on grain-carrying data is scoped by the grain the CONTRACT resolved — not by this
// component re-deriving it. Which links are scoped is decided by the backend from the target's own
// schema, so a link added later inherits this without anyone tagging it.
function linkFilters(field) {
  return field.grain_scoped ? ctx.data?.grain || {} : {}
}

function pickPlaceholder(field) {
  return field.type === 'Field' ? __('Choose a field to set') : __('Choose a value')
}

// Empty for two different reasons, and the author can act on only one of them.
function pickEmpty(field) {
  if (field.type === 'Field') {
    return __('No fields on this subject may be set by automation yet.')
  }
  return subjectDoctype.value
    ? __('Nothing upstream produces a value yet — add a node before this one.')
    : __('Choose a subject on the Trigger first.')
}

function selectOptions(field) {
  return (field.options || []).map((o) => ({ label: __(o), value: o }))
}

// ONE call answers everything this node needs to be authored: its subject, the grain in force, the
// values it can read, the fields it may write, and the operator vocabulary. Three separate calls was the
// mess — a control cannot be scoped by something it was never handed, and every extra call was a place
// the grain got dropped. It was dropped, repeatedly.
const ctx = createResource({
  url: 'tatva_connect.workflow_engine.context.node_context',
  makeParams: () => ({ nodes: JSON.stringify(props.graph), node_id: props.node.node_id }),
})

// Re-resolved when the node changes or the graph is rewired: position determines all of the above, so a
// stale answer offers values this node cannot actually reach.
watch(
  () => [props.node.node_id, JSON.stringify(props.graph)],
  () => ctx.reload(),
  { immediate: true },
)

const subjectDoctype = computed(() => ctx.data?.subject || '')
const predicateFields = computed(() => ctx.data?.variables || [])
const settableFields = computed(() => ctx.data?.settable || [])
const operatorShapes = computed(() => ctx.data?.operator_shapes || {})
const operatorsByType = computed(() => ctx.data?.operators_by_type || {})

function setConfig(name, value) {
  const next = { ...config.value }
  if (value === null || value === undefined || value === '') delete next[name]
  else next[name] = value
  props.node.config_json = JSON.stringify(next)
  // Changing the field a type keys its outputs on changes its handles; let the canvas prune.
  if (name === declaration.value?.outputs_by?.field) emit('shape-change')
}

// §4 — a destructive action asks first, through the app's one Dialogs host.
function confirmDelete() {
  createDialog({
    title: __('Delete node'),
    message: __('Remove {0} and every connection to it?', [props.node.node_id]),
    actions: [
      {
        label: __('Delete'),
        variant: 'solid',
        theme: 'red',
        onClick: (close) => {
          close()
          emit('delete', props.node.node_id)
        },
      },
    ],
  })
}

</script>
