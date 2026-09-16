<!-- TATVA: SmartViewEditor — the Smart View authoring modal: three inline steps (Details, Condition, Columns; no popovers inside a modal), saved via upsert_view and deleted via delete_view, both re-validated server-side. -->
<template>
  <ResponsiveDialog v-model="open" :options="{ size: '3xl', title: titleText }">
    <template #body-content>
      <!-- step rail -->
      <div class="mb-4 flex items-center gap-1.5 text-sm">
        <template v-for="(s, i) in steps" :key="s.key">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded px-2 py-1 duration-150 ease-in-out"
            :class="
              step === i + 1
                ? 'font-medium text-ink-gray-9'
                : 'text-ink-gray-5 hover:text-ink-gray-8'
            "
            :disabled="i + 1 > furthestStep"
            @click="i + 1 <= furthestStep && (step = i + 1)"
          >
            <span
              class="flex h-5 w-5 items-center justify-center rounded-full text-xs"
              :class="step === i + 1 ? 'bg-surface-gray-7 text-ink-white' : 'bg-surface-gray-3 text-ink-gray-6'"
            >
              {{ i + 1 }}
            </span>
            {{ s.label }}
          </button>
          <div v-if="i < steps.length - 1" class="h-px w-4 bg-outline-gray-2" />
        </template>
      </div>

      <!-- No height here on purpose: the dialog is content-sized, so each step takes its natural height and only unbounded lists cap themselves. -->
      <div class="flex flex-col">
      <!-- step 1: details; labels use FormControl's own `label` + `required` for the asterisk and a real <label for>. -->
      <div v-if="step === 1" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <FormControl
          v-model="draft.label"
          type="text"
          :label="__('Name')"
          required
          :placeholder="__('My Open Leads')"
        />
        <div>
          <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Type') }}</div>
          <!-- Autocomplete, not a native <select>, whose browser-drawn option list cannot carry the theme. -->
          <Autocomplete
            :modelValue="draft.base_object"
            :options="baseOptions"
            :disabled="isEdit"
            @update:modelValue="(v) => v?.value && onBasePicked(v.value)"
          />
          <div v-if="isEdit" class="mt-1 text-xs text-ink-gray-4">
            {{ __('Type cannot be changed after creation.') }}
          </div>
        </div>
        <div v-if="draft.base_object === 'Activity'">
          <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Activity Type') }}</div>
          <!-- Searchable because a site carries many task types; it emits the option object, so take its .value. -->
          <Autocomplete
            :modelValue="draft.activity_type"
            :options="activityTypeOptions"
            :placeholder="__('Select an activity type')"
            :disabled="isEdit"
            @update:modelValue="(v) => onActivityTypePicked(v?.value ?? null)"
          />
        </div>
        <!-- GrainSelect, the same grain control the Lead/Deal create modal uses. -->
        <GrainSelect
          :modelValue="grainKey"
          :disabled="isEdit"
          @update:modelValue="onGrainPicked"
        />
        <FormControl
          v-model="draft.description"
          type="textarea"
          :label="__('Description')"
          :placeholder="__('Optional')"
        />
      </div>

      <!-- step 2: condition (inline builder — no popover escapes the modal) -->
      <div v-else-if="step === 2" class="flex min-h-0 flex-1 flex-col gap-3">
        <div class="text-sm text-ink-gray-5">
          {{ __('Show records matching these conditions. Leave empty to include all.') }}
        </div>
        <!-- The shared predicate control, handed this surface's fields, operators and value controls; `max-depth` 1 because a view stores one flat group. -->
        <PredicateInput
          v-if="catalogReady"
          v-model="predicate"
          v-model:valid="predicateValid"
          :fields="predicateFields"
          :operators-by-type="operatorsByType"
          :shapes="shapes"
          :max-depth="1"
        >
          <!-- An unfinished condition is refused when the step is left, not marked on the row. -->
          <template #value="{ node, field, patch }">
            <component
              :is="resolveControl(field, node.operator).is"
              class="min-w-0"
              v-bind="resolveControl(field, node.operator).props"
              :modelValue="boundValue(field, node)"
              @update:modelValue="(v) => patch({ value: unwrapValue(v) })"
            />
          </template>
        </PredicateInput>
        <div v-else class="flex items-center gap-2 text-sm text-ink-gray-4">
          <span>{{ catalogHint }}</span>
          <Button v-if="catalogFailed" variant="subtle" size="sm" :label="__('Retry')" @click="catalog.reload()" />
        </div>
      </div>

      <!-- step 3: columns (two-panel manager) -->
      <div v-else class="flex min-h-0 flex-1 flex-col gap-3">
        <div class="text-sm text-ink-gray-5">
          {{ __('Choose and order the columns. Leave empty for the default set.') }}
        </div>
        <!-- Capped height: the dialog is content-sized, so an uncapped column list pushes the footer off screen. -->
        <ColumnManager
          v-if="catalogReady"
          v-model="columnKeys"
          :fields="catalogFields"
          :alwaysShown="alwaysShownColumns"
          class="min-h-0 sm:!h-[45dvh]"
        />
        <div v-else class="flex items-center gap-2 text-sm text-ink-gray-4">
          <span>{{ catalogHint }}</span>
          <Button v-if="catalogFailed" variant="subtle" size="sm" :label="__('Retry')" @click="catalog.reload()" />
        </div>
      </div>

      </div>

      <!-- Footer lives in body-content, not #actions, whose slot padding leaves a dead gap above the buttons. -->
      <div class="mt-4 flex items-center gap-2">
        <div class="ml-auto flex gap-2">
          <!-- Destructive wears the house's one destructive look: solid red with the trash icon, never a ghost. -->
          <Button
            v-if="isEdit && draft.can_write"
            :label="__('Delete')"
            icon-left="trash-2"
            variant="solid"
            theme="red"
            @click="confirmDelete"
          />
          <Button v-if="step > 1" :label="__('Back')" @click="step--" />
          <Button
            v-if="step < 3"
            variant="solid"
            :label="__('Next')"
            @click="goNext"
          />
          <Button
            v-else
            variant="solid"
            :label="isEdit ? __('Save changes') : __('Create view')"
            :loading="saving"
            @click="save"
          />
        </div>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { Button, FormControl, createResource, call, toast } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { PredicateInput } from '@/tatva/predicate'
import { operatorsByType, shapes } from '@/tatva/smartViewConditions'
import { resolveControl, toOption, fromOption } from '@/tatva/fieldControl'
import ColumnManager from '@/tatva/ColumnManager.vue'
import GrainSelect from '@/tatva/GrainSelect.vue'
import { createDialog } from '@/utils/dialogs'
import {
  useEntitledGrains,
  axesFromKey,
  keyFromAxes,
} from '@/tatva/useEntitledGrains'
import { catalogParams } from '@/tatva/smartViewCatalog'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

const props = defineProps({
  // The view NAME to edit, or null/'' to create.
  viewName: { type: String, default: '' },
})
const open = defineModel({ type: Boolean })
const emit = defineEmits(['saved', 'deleted'])

const steps = [
  { key: 'details', label: __('Details') },
  { key: 'condition', label: __('Condition') },
  { key: 'columns', label: __('Columns') },
]

const baseOptions = [
  { label: __('Leads'), value: 'Lead' },
  { label: __('Activities'), value: 'Activity' },
]

const blank = () => ({
  name: '',
  label: '',
  base_object: 'Lead',
  activity_type: '',
  description: '',
  vertical: '',
  group: '',
  program: '',
  predicate: null,
  columns: [],
  can_write: true,
})

const draft = reactive(blank())
const step = ref(1)
const furthestStep = ref(1)
const saving = ref(false)

// From the prop, so the title and edit-only notices render on the first frame rather than when get_view lands.
const isEdit = computed(() => !!props.viewName)
const titleText = computed(() => (isEdit.value ? __('Edit Smart View') : __('New Smart View')))

// --- activity types: scoped to the chosen grain by the same rule the save gate uses, so every offered type will save ---
const taskTypes = createResource({
  url: 'tatva_connect.activity.api.list_types_for_grain',
  makeParams: () => ({
    vertical: draft.vertical || undefined,
    group: draft.group || undefined,
    program: draft.program || undefined,
  }),
})
const activityTypeOptions = computed(() =>
  (taskTypes.data || []).map((t) => ({ label: t.label || t.name, value: t.name })),
)

// --- grain the view is scoped to: options from the one grain brain (a cached singleton), keyed `v::g::p` ---
const grainKey = ref('')
const { resource: grainResource, grainAll, grainOptions } = useEntitledGrains()
// An inline control models an OPTION and the predicate holds plain values, so dress in and undress out.
function boundValue(field, node) {
  const { props, arity } = resolveControl(field, node.operator)
  if (!props?.options) return node.value
  if (arity === 'many') return (Array.isArray(node.value) ? node.value : []).map((v) => toOption(v, props.options))
  return toOption(node.value, props.options)
}

function unwrapValue(value) {
  return Array.isArray(value) ? value.map(fromOption) : fromOption(value)
}

function keyFromDraft() {
  if (!(draft.vertical || draft.group || draft.program)) return ''
  return keyFromAxes(draft)
}

// --- the field catalog feeds the condition + column controls ---------------
const catalog = createResource({
  url: 'tatva_connect.smartview.api.field_catalog',
  makeParams: () => catalogParams(draft),
})

// Resolved-and-empty (no entitlement) is a real state, tracked apart from still-fetching.
const catalogSettled = computed(() => Array.isArray(catalog.data) && !catalog.loading)
const catalogReady = computed(() => {
  if (draft.base_object === 'Activity' && !draft.activity_type) return false
  return Array.isArray(catalog.data) && catalog.data.length > 0
})
const catalogEmpty = computed(() => catalogSettled.value && catalog.data.length === 0)
// A failed fetch is its own state, not still-loading, and the only one offering Retry.
const catalogFailed = computed(() => !!catalog.error && !catalog.loading)
// The save gate blocks only on empty or failed, never on loading, so a slow network never stops someone with access.
const catalogBlocked = computed(() => catalogEmpty.value || catalogFailed.value)
const catalogHint = computed(() => {
  if (draft.base_object === 'Activity' && !draft.activity_type) return __('Pick an activity type first.')
  if (catalogFailed.value) return __('Could not load the fields for this scope.')
  if (catalogEmpty.value)
    return __('No fields are available for this scope. Ask an administrator to grant access to this grain.')
  return __('Loading fields…')
})

const toField = (c) => ({
  fieldname: c.field_key,
  label: c.label,
  fieldtype: c.fieldtype,
  options: c.options,
})
// ColumnManager's generic field shape, with field_key as the identifier.
const catalogFields = computed(() => (catalog.data || []).map(toField))
// Always-shown columns are named by the server, never decided by the picker, so both agree on what a view shows.
const alwaysShownColumns = computed(() =>
  (catalog.data || []).filter((c) => c.always_shown).map((c) => c.field_key),
)
// PredicateInput's shape: `key` is stored in the tree, `type` picks operators, `group` is the section; fieldtype/options feed the value slot.
const predicateFields = computed(() =>
  (catalog.data || [])
    .filter((c) => c.filterable)
    .map((c) => ({
      key: c.field_key,
      label: c.label,
      type: c.fieldtype,
      group: c.section_title || '',
      fieldtype: c.fieldtype,
      options: c.options,
    })),
)

// The predicate tree and ordered column keys, bound as the saved shapes with no conversion.
const predicate = ref(null)
// Reported by the builder; an unfinished condition blocks Save rather than being dropped.
const predicateValid = ref(true)
const columnKeys = ref([])

// Seeds both from the draft once the scope's catalog loads, dropping keys not in that scope.
function seedFromDraft() {
  predicate.value = draft.predicate || null
  const valid = new Set((catalog.data || []).map((c) => c.field_key))
  const chosen = (draft.columns || []).filter((k) => valid.has(k))
  // Led by the always-shown ones, exactly as the composer leads them, so the picker shows what the list will.
  const always = alwaysShownColumns.value.filter((k) => valid.has(k))
  columnKeys.value = [...always, ...chosen.filter((k) => !always.includes(k))]
}
watch(
  () => catalog.data,
  (d) => {
    if (Array.isArray(d)) seedFromDraft()
  },
)

// Autocomplete emits the option object, so the value is assigned here before the shared invalidation runs.
function onBasePicked(value) {
  draft.base_object = value
  onScopeChange()
}

function onActivityTypePicked(value) {
  draft.activity_type = value
  onScopeChange()
}

function onScopeChange() {
  // a fresh scope invalidates the old predicate/columns
  draft.predicate = null
  draft.columns = []
  predicate.value = null
  columnKeys.value = []
  catalog.reload()
  taskTypes.reload() // the offered types are grain-scoped, so a new grain re-offers them
}

// A new grain invalidates the predicate/columns; `loaded` skips GrainSelect's silent first apply, which onMounted already fetches for.
const loaded = ref(false)
function onGrainPicked(key) {
  if (key === grainKey.value) return
  grainKey.value = key
  Object.assign(draft, axesFromKey(key))
  if (loaded.value) onScopeChange()
}

// --- step gating: what a step still needs, or '' when finished — the gate and its message are one function ---
function unmetOn(n) {
  if (n === 1) {
    if (!draft.label.trim()) return __('Give the view a name.')
    if (draft.base_object === 'Activity' && !draft.activity_type) return __('Pick an activity type.')
    if (!isEdit.value && !grainAll.value && grainOptions.value.length && !grainKey.value)
      return __('Choose the business line this view is for.')
    return ''
  }
  if (catalogBlocked.value) return catalogHint.value
  if (n === 2 && !predicateValid.value) return __('Every condition needs a value.')
  return ''
}

// Save answers for every step, because Create is refused by anything left unfinished behind it.
const unmetToSave = computed(() => unmetOn(1) || unmetOn(2) || unmetOn(3))

function goNext() {
  const unmet = unmetOn(step.value)
  if (unmet) return toast.error(unmet)
  step.value += 1
  if (step.value > furthestStep.value) furthestStep.value = step.value
}

// --- load on open: the mount site's v-if gives a fresh instance, so all state starts at its declared defaults ---
onMounted(async () => {
  // A rejected grain fetch must not abort the hook; the catalog's own settled/failed states take over.
  await grainResource.promise?.catch?.(() => {})
  // Let GrainSelect's queued watch apply the grain first, or the catalog fetch goes out twice.
  await nextTick()
  if (props.viewName) {
    try {
      const d = await call('tatva_connect.smartview.api.get_view', { name: props.viewName })
      Object.assign(draft, {
        name: d.name,
        label: d.label || '',
        base_object: d.base_object || 'Lead',
        activity_type: d.activity_type || '',
        description: d.description || '',
        vertical: d.vertical || '',
        group: d.group || '',
        program: d.program || '',
        predicate: d.predicate || null,
        columns: d.columns || [],
        can_write: d.can_write,
      })
      grainKey.value = keyFromDraft()
      // An existing view is valid on every step, so any step is reachable directly.
      furthestStep.value = steps.length
    } catch {
      toast.error(__('Could not load this view.'))
      open.value = false
      return
    }
  }
  // GrainSelect has already applied a single entitled grain by now, so draft carries it.
  catalog.reload() // seedFromDraft runs from the catalog watch once data lands
  taskTypes.reload() // offered types are grain-scoped, so they resolve here too, not at setup
  loaded.value = true
})

// --- save / delete ---------------------------------------------------------
async function save() {
  const unmet = unmetToSave.value
  if (unmet) return toast.error(unmet)
  saving.value = true
  try {
    const payload = {
      name: draft.name || undefined,
      label: draft.label.trim(),
      base_object: draft.base_object,
      activity_type: draft.base_object === 'Activity' ? draft.activity_type : undefined,
      description: draft.description || undefined,
      vertical: draft.vertical || undefined,
      group: draft.group || undefined,
      program: draft.program || undefined,
      predicate: predicate.value,
      columns: columnKeys.value,
    }
    const tab = await call('tatva_connect.smartview.api.upsert_view', { view: payload })
    toast.success(isEdit.value ? __('View updated') : __('View created'))
    open.value = false
    emit('saved', tab)
  } catch (e) {
    toast.error(e?.messages?.[0] || e?.message || __('Could not save the view.'))
  } finally {
    saving.value = false
  }
}

function confirmDelete() {
  createDialog({
    title: __('Delete view'),
    message: __('Delete "{0}"? This cannot be undone.', [draft.label]),
    variant: 'danger',
    actions: [
      {
        label: __('Delete'),
        variant: 'solid',
        theme: 'red',
        onClick: async (close) => {
          try {
            await call('tatva_connect.smartview.api.delete_view', { name: draft.name })
            toast.success(__('View deleted'))
            close()
            open.value = false
            emit('deleted', draft.name)
          } catch (e) {
            toast.error(e?.messages?.[0] || e?.message || __('Could not delete the view.'))
          }
        },
      },
    ],
  })
}
</script>
