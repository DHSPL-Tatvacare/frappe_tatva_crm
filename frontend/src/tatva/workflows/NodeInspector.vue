<!-- TATVA: node inspector (right panel). -->
<template>
  <!-- Width is the CANVAS's, not this panel's: `:key="selectedId"` remounts the inspector on every node
       click, so a width held here would snap back to the default each time the author picked a node. -->
  <aside
    class="flex shrink-0 flex-col border-l border-outline-gray-2 bg-surface-white"
    :style="{ width: `${width}px` }"
  >
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
      <!-- Faults on this node that name no control — they belong to the node, so they sit above its fields.
           Colour is the backend's `severity`, never the canvas's guess (C17.1): a block is red, a warning
           amber; the fix is a muted second line on what to do. -->
      <div v-for="(p, i) in nodeProblems" :key="`n${i}`" class="text-sm">
        <p :class="severityClass(p)">{{ p.message }}</p>
        <p v-if="p.fix" class="mt-0.5 text-xs text-ink-gray-5">{{ p.fix }}</p>
      </div>

      <div v-for="f in visibleFields" :key="f.name">
        <div
          v-if="COMPOSITE.includes(f.control)"
          class="mb-1 text-xs text-ink-gray-5"
        >
          {{ __(f.label) }}
          <span v-if="f.reqd" class="text-ink-red-2">*</span>
        </div>

        <PredicateBuilder
          v-if="f.control === 'predicate'"
          :modelValue="config[f.name] || null"
          :fields="predicateFields"
          :allFields="allVariables"
          :operatorShapes="operatorShapes"
          :operatorsByType="operatorsByType"
          :subject="subjectDoctype"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <RouteRows
          v-else-if="f.control === 'route-rows'"
          :modelValue="config[f.name] || []"
          :fields="predicateFields"
          :allFields="allVariables"
          :operatorShapes="operatorShapes"
          :operatorsByType="operatorsByType"
          :subject="subjectDoctype"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <SampleRows
          v-else-if="f.control === 'sample-rows'"
          :modelValue="config[f.name] || []"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <ResponseMapping
          v-else-if="f.control === 'mapping'"
          :modelValue="config[f.name] || []"
          :preview="f.preview || null"
          :previewArgs="previewArgs(f)"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <ButtonList
          v-else-if="f.control === 'button-list'"
          :modelValue="config[f.name] || []"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <FieldMap
          v-else-if="f.control === 'field-map'"
          :modelValue="config[f.name] || []"
          :modes="f.modes || []"
          :modeControls="f.mode_controls || {}"
          :fieldRows="pickRows(f)"
          :valueRows="valueRows(predicateFields)"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <ValueMap
          v-else-if="f.control === 'value-map'"
          :modelValue="config[f.name] || []"
          :label="f.label"
          :source="config[f.slots_from] || ''"
          :slotsMethod="f.slots_method"
          :slotsArgs="declaredArgs(f.slots_args)"
          :preview="f.preview || null"
          :previewArgs="previewArgs(f)"
          :modes="f.modes || []"
          :valueRows="valueRows(predicateFields)"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <FormControl
          v-else-if="f.control === 'graph-select'"
          type="select"
          :label="__(f.label)"
          :options="graphOptions(f)"
          :modelValue="config[f.name]"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <Link
          v-else-if="f.control === 'link' || f.control === 'grain'"
          :label="__(f.label)"
          :doctype="f.link"
          :filters="linkFilters(f)"
          :value="config[f.name] || ''"
          :placeholder="f.control === 'grain' ? __('Any') : __('Select option')"
          :disabled="!editable"
          @change="(v) => setConfig(f.name, v)"
        />

        <RemoteSelect
          v-else-if="f.control === 'remote-select'"
          :modelValue="config[f.name] || ''"
          :label="f.label"
          :reqd="f.reqd"
          :disabled="!editable"
          :source="config[f.options_from] || ''"
          :optionsMethod="f.options_method"
          :detailMethod="f.detail_method || ''"
          :placeholderText="f.placeholder || 'Select option'"
          :emptyText="f.empty_text || undefined"
          :gateText="f.gate_text || undefined"
          :detailLabel="f.detail_label || undefined"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <!-- W3.1 — the working set. Multi-select with grouped options and a select-all/clear footer, all
             native to `Autocomplete`; nothing is hand-rolled and no resource is created, because the set
             and its choices are config already on the wire. Cleared to nothing when emptied, so a blank
             set is stored as ABSENT and reads as "no restriction". -->
        <div v-else-if="f.control === 'field-set'">
          <div class="mb-1 text-xs text-ink-gray-5">{{ __(f.label) }}</div>
          <Autocomplete
            :multiple="true"
            :modelValue="config[f.name] || []"
            :options="workingSetChoices"
            :placeholder="__(f.placeholder || 'Every field on the subject')"
            :disabled="!editable"
            @update:modelValue="(v) => setConfig(f.name, pickedKeys(v))"
          />
          <p class="mt-1 text-xs leading-snug text-ink-gray-4">{{ workingSetHint(f) }}</p>
        </div>

        <FormControl
          v-else-if="f.control === 'select'"
          type="select"
          :label="__(f.label)"
          :options="selectOptions(f)"
          :modelValue="config[f.name]"
          :disabled="!editable"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <FormControl
          v-else-if="f.control === 'textarea' || f.control === 'code'"
          type="textarea"
          :label="__(f.label)"
          :rows="3"
          :modelValue="config[f.name]"
          :disabled="!editable"
          :placeholder="f.placeholder || ''"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <!-- Hovering a value points at the node that produced it. `source` already rides on every
             variable, so this is an index over data on the wire, not a second resolution of it. -->
        <div
          v-else-if="f.control === 'value-picker' || f.control === 'field-picker'"
          data-test="value-picker"
          @mouseenter="$emit('spotlight', producerOf(f))"
          @mouseleave="$emit('spotlight', null)"
        >
          <div class="mb-1 text-xs text-ink-gray-5">
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
          <p v-if="!pickRows(f).length" class="mt-1 text-xs text-ink-gray-4">
            {{ pickEmpty(f) }}
          </p>
          <!-- Rule 4: the narrowing is never a wall. Shown only while it is actually hiding something,
               so a workflow that declared no working set gains no control it does not need. -->
          <button
            v-if="hiddenCount(f)"
            type="button"
            class="mt-1 text-xs text-ink-blue-3 hover:underline"
            @click="toggleAll(f)"
          >
            {{
              showingAll[f.name]
                ? __('Show only the fields this workflow uses')
                : __('Show all fields ({0} more)', [hiddenCount(f)])
            }}
          </button>
        </div>


        <FormControl
          v-else
          :type="f.control === 'data' ? 'text' : f.control"
          :label="__(f.label)"
          :modelValue="config[f.name]"
          :disabled="!editable"
          :placeholder="f.placeholder || ''"
          @update:modelValue="(v) => setConfig(f.name, v)"
        />

        <!-- Interpolated, not v-html: these messages carry values the author typed, and frappe-ui's
             ErrorMessage would render them as markup. Colour is the backend's severity; the fix is muted. -->
        <div v-for="(p, i) in problemsFor(f.name)" :key="i" class="mt-1 text-sm">
          <p :class="severityClass(p)">{{ p.message }}</p>
          <p v-if="p.fix" class="mt-0.5 text-xs text-ink-gray-5">{{ p.fix }}</p>
        </div>
      </div>

      <p v-if="!visibleFields.length" class="pt-1 text-xs leading-snug text-ink-gray-4">
        {{ __('This node type has no settings. Connect its handles on the canvas.') }}
      </p>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { FormControl, Button, Autocomplete, createResource } from 'frappe-ui'
import PredicateBuilder from '@/tatva/PredicateBuilder.vue'
import RouteRows from './RouteRows.vue'
import SampleRows from './SampleRows.vue'
import ResponseMapping from '@/tatva/ResponseMapping.vue'
import ValueMap from '@/tatva/ValueMap.vue'
import ButtonList from './ButtonList.vue'
import FieldMap from './FieldMap.vue'
import RemoteSelect from './RemoteSelect.vue'
import Link from '@/components/Controls/Link.vue'
import { useNodeTypes } from '@/tatva/useNodeTypes'
import { createDialog } from '@/utils/dialogs'
import { categoryFor, iconFor } from './nodeCatalog'
import { configOf } from './graphMap'
import {
  valueRows,
  fieldRows,
  groupedOptions,
  variableFor,
  subjectKeyOf,
  narrowVariables,
  narrowSettable,
  workingSetOptions,
} from '@/tatva/valueOptions'

const props = defineProps({
  node: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  // Every node on the canvas, so a Wait can offer the nodes it may wait on and their outcomes.
  graph: { type: Array, default: () => [] },
  // This node's publish faults. The canvas badges the node; only here is there a control to point at.
  problems: { type: Array, default: () => [] },
  // Owned by the canvas so it survives this panel's per-node remount.
  width: { type: Number, default: 288 },
})
const emit = defineEmits(['close', 'update:config', 'shape-change', 'delete', 'spotlight'])

const { declarationFor, configFieldsFor, appliedFieldsFor } = useNodeTypes()

const declaration = computed(() => declarationFor(props.node.node_type))
const category = computed(() => categoryFor(props.node.node_type))
// The node type's own label — the same title the card shows, so the panel and the box always agree.
const title = computed(() => __(declaration.value?.label || props.node.node_type || 'Node'))

// The node stores its settings as JSON text; the inspector edits an object and writes it back. Guarded
// so a malformed value renders an empty panel rather than throwing on the render path (§12).
const config = computed(() => configOf(props.node))

// Only the fields this type declares, minus any whose gate is shut.
const visibleFields = computed(() => appliedFieldsFor(props.node.node_type, config.value))

// Controls that are not FormControls, so they carry no `label` prop and need a heading rendered above.
const COMPOSITE = ['predicate', 'mapping', 'value-map', 'field-map', 'route-rows', 'sample-rows']

// A preview's arguments are sibling fields, named by the declaration and read off this node's config.
function previewArgs(field) {
  return declaredArgs(field.preview?.args)
}

// The same rule for any control that needs SIBLING values: the declaration names {argument: field}, and
// this reads those fields off the node. A voice agent id means nothing without the account it lives on.
function declaredArgs(named) {
  return Object.fromEntries(Object.entries(named || {}).map(([arg, from]) => [arg, config.value[from] ?? '']))
}

// Severity → text colour, WHOLE class strings so the Tailwind v4 JIT scanner can see them (an interpolated
// class is invisible to it). Same shape as WorkflowNode's LIVE_RING map; the tokens are design-system `ink`
// colours, theme-aware in both light and dark. `blocks` is the floor, so an unknown severity reads as red.
const SEVERITY_TEXT = {
  blocks: 'text-ink-red-4',
  warns: 'text-ink-amber-3',
}
function severityClass(p) {
  return SEVERITY_TEXT[p.severity] || SEVERITY_TEXT.blocks
}

// A fault names the control it belongs to, so it renders under that control and nowhere else.
function problemsFor(name) {
  return props.problems.filter((p) => p.field === name)
}

// The rest belong to the node itself — no control to sit under, so they head the panel.
const nodeProblems = computed(() => props.problems.filter((p) => !p.field))

// C17.1 — which nodes may be waited on is a POSITIONAL question and the backend answers it, off the same
// ancestor walk the value picker and the publish gate use. This filtered `props.graph` on can-emit and
// not-self, so a Wait was offered its own DESCENDANTS and publish then refused the graph it produced.
const upstreamEmitters = computed(() => ctx.data?.emitters || [])

function graphOptions(field) {
  // The records a write may target: the lead, and the doc that fired the journey. Real doctype NAMES,
  // because that is what the handler compares against — a friendly label here would never match.
  if (field.control === 'graph-select' && field.name === 'target_doctype') {
    const targets = ['CRM Lead']
    if (subjectDoctype.value && !targets.includes(subjectDoctype.value)) targets.push(subjectDoctype.value)
    return targets.map((t) => ({ label: t, value: t }))
  }
  if (field.name === 'source_node') {
    return upstreamEmitters.value.map((n) => ({ label: n.label, value: n.node_id }))
  }
  // The outcome comes off the SAME entry, so the two pickers cannot disagree about what a node reports.
  const source = upstreamEmitters.value.find((n) => n.node_id === config.value.source_node)
  return (source?.outcomes || []).map((o) => ({ label: o, value: o }))
}

// Rows for THIS control: a `Field` picks a write target, anything else picks a value to read. Two
// questions, two brains, one row shape — grouped and rendered identically from there on.
function pickRows(field) {
  const all = showingAll.value[field.name]
  return field.control === 'field-picker' || field.control === 'field-map'
    ? fieldRows(all ? allSettable.value : settableFields.value)
    : valueRows(all ? allVariables.value : predicateFields.value)
}

// The third argument is what still RESOLVES: a reference the working set does not name keeps its real
// label instead of degrading to its own raw ref (rule 3 — narrowing must not break an existing workflow,
// and an unreadable label is a way of breaking it).
function pickOptions(field) {
  const knownRows =
    field.control === 'field-picker' ? fieldRows(allSettable.value) : valueRows(allVariables.value)
  return groupedOptions(pickRows(field), config.value[field.name], knownRows)
}

// Which NODE produced the value this control holds, or null. `source` is the namespace a reference is
// written with, and for anything an upstream node emitted that namespace IS the node's id
// (`upstream._emitted_by`) — so the index the spotlight needs is already on the wire and nothing has to
// be re-derived from the ref string. A subject field's source is a doctype slug (`crm_lead`), which
// names no node, and a `field-picker` picks a WRITE target that no node produced: both answer null.
//
// C17.1 — the row's own `emitted` is what says which of those it is. This used to scan `props.graph` for
// a node with that id, which is the canvas re-deciding what the backend already answered.
function producerOf(field) {
  if (field.control !== 'value-picker') return null
  const variable = variableFor(predicateFields.value, config.value[field.name])
  return variable?.emitted ? variable.source : null
}

// A picker drawing on grain-carrying data is scoped by the grain the CONTRACT resolved — not by this
// component re-deriving it. Which links are scoped is decided by the backend from the target's own
// schema, so a link added later inherits this without anyone tagging it.
function linkFilters(field) {
  return field.grain_scoped ? ctx.data?.grain || {} : {}
}

function pickPlaceholder(field) {
  return field.control === 'field-picker' ? __('Choose a field to set') : __('Choose a value')
}

// Empty for two different reasons, and the author can act on only one of them.
function pickEmpty(field) {
  if (field.control === 'field-picker') {
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
// A keystroke rewrites a node the `graph` prop holds, re-triggering the watcher below, so the reload is
// debounced. The timer is ours + cancelable so an unmount before it fires can't leave a fetch to reject.
const ctx = createResource({
  url: 'tatva_connect.workflow_engine.context.node_context',
  makeParams: () => ({ nodes: JSON.stringify(props.graph), node_id: props.node.node_id }),
})

let reloadTimer
function reloadCtx() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => ctx.reload(), 300)
}

// Re-resolved when the node changes or the graph is rewired: position determines all of the above, so a
// stale answer offers values this node cannot actually reach.
watch(
  () => [props.node.node_id, JSON.stringify(props.graph)],
  reloadCtx,
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(reloadTimer))

const subjectDoctype = computed(() => ctx.data?.subject || '')

// W3.1 — what the backend ANSWERED, before any narrowing. Kept because rule 4's "Show all fields" needs
// it and because the working set is a presentation filter over data already held: no second fetch, no
// resource per control, no request per picker.
const allVariables = computed(() => ctx.data?.variables || [])
const allSettable = computed(() => ctx.data?.settable || [])
// Declared on the Trigger, answered here for every node — so a picture six nodes down narrows to the
// same set as the Trigger's own predicate. Blank means no restriction.
const workingSet = computed(() => ctx.data?.working_set || [])
const predicateFields = computed(() =>
  narrowVariables(allVariables.value, workingSet.value),
)
const settableFields = computed(() =>
  narrowSettable(allSettable.value, workingSet.value, subjectDoctype.value),
)

// Per-control escape hatch (rule 4), keyed by the config field it belongs to so two pickers on one node
// do not share a toggle. Local state: a store for a hover-level preference would outlive its only reader.
const showingAll = ref({})
function toggleAll(field) {
  showingAll.value = { ...showingAll.value, [field.name]: !showingAll.value[field.name] }
}

// How many rows the working set is hiding from THIS control right now — 0 when nothing is declared, so
// the affordance never appears on a workflow that never narrowed.
function hiddenCount(field) {
  const full = field.control === 'field-picker' ? allSettable.value : allVariables.value
  const narrowed = field.control === 'field-picker' ? settableFields.value : predicateFields.value
  return full.length - narrowed.length
}

// The Trigger's own control: every subject field, writable ones first. Choices come from the same two
// lists every other picker reads, so a field cannot be declarable here and invisible below.
const workingSetChoices = computed(() =>
  workingSetOptions(allVariables.value, allSettable.value, subjectDoctype.value),
)

// `Autocomplete` in multiple mode hands back option OBJECTS; the config stores bare keys. An emptied
// selection is stored as ABSENT, not as `[]`, so "no restriction" has one representation.
function pickedKeys(chosen) {
  const keys = (chosen || []).map((o) => o?.value ?? o).filter(Boolean)
  return keys.length ? keys : null
}

function workingSetHint(field) {
  const chosen = (config.value[field.name] || []).length
  if (!chosen) return __('Every field on {0} is offered below.', [subjectDoctype.value || __('the subject')])
  return __('{0} of {1} fields. Pickers below offer these; nothing is blocked.', [
    chosen,
    allVariables.value.filter((v) => subjectKeyOf(v) !== null).length,
  ])
}
const operatorShapes = computed(() => ctx.data?.operator_shapes || {})
const operatorsByType = computed(() => ctx.data?.operators_by_type || {})

// Emitted, never assigned into `props.node`: that object is the canvas's own node row, so writing it here
// made a child mutate its parent's state and silently re-triggered every watcher on the graph.
function setConfig(name, value) {
  const next = { ...config.value }
  if (value === null || value === undefined || value === '') delete next[name]
  else next[name] = value
  emit('update:config', JSON.stringify(next))
  // Changing the field a type keys its outputs on changes its handles; let the canvas re-resolve and prune.
  // The field says so itself — reading the resolution rule to find out was the same defect one level up.
  if (configFieldsFor(props.node.node_type).some((f) => f.name === name && f.shapes_outputs)) {
    emit('shape-change')
  }
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
