<!--
  TATVA: SmartViewEditor — the authoring drawer for Smart Views (create / edit / delete). A native
  frappe-ui Dialog with a 3-step flow, reusing native primitives end-to-end (NO parallel engine):

    1. Details   — name, type (Lead/Activity), activity type, description (native FormControl).
    2. Condition — the SAME native components/Filter.vue, fed our field_catalog via its `fields` prop;
                   its emit is mapped to the composer predicate tree (smartViewPredicate.js).
    3. Columns   — the SAME native components/ColumnSettings.vue, fed the catalog via `fieldSource`;
                   the chosen/ordered keys become the view's column list.

  Save goes through tatva_connect.smartview.api.upsert_view (catalog-validated, owner-scoped, capped);
  delete through delete_view (owner-scoped) behind the native confirm dialog. The editor never trusts
  itself — the server re-validates every field and the ownership rule on every write.
-->
<template>
  <Dialog v-model="open" :options="{ size: '2xl', title: titleText }">
    <template #body-content>
      <!-- step rail -->
      <div class="mb-5 flex items-center gap-1.5 text-sm">
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

      <!-- step 1: details -->
      <div v-if="step === 1" class="flex flex-col gap-4">
        <div>
          <div class="mb-1.5 text-sm text-ink-gray-5">{{ __('Name') }}</div>
          <FormControl
            v-model="draft.label"
            type="text"
            :placeholder="__('My Open Leads')"
          />
        </div>
        <div>
          <div class="mb-1.5 text-sm text-ink-gray-5">{{ __('Type') }}</div>
          <FormControl
            v-model="draft.base_object"
            type="select"
            :options="baseOptions"
            :disabled="isEdit"
            @update:modelValue="onScopeChange"
          />
          <div v-if="isEdit" class="mt-1 text-xs text-ink-gray-4">
            {{ __('Type cannot be changed after creation.') }}
          </div>
        </div>
        <div v-if="draft.base_object === 'Activity'">
          <div class="mb-1.5 text-sm text-ink-gray-5">{{ __('Activity Type') }}</div>
          <FormControl
            v-model="draft.activity_type"
            type="select"
            :options="activityTypeOptions"
            :placeholder="__('Select an activity type')"
            :disabled="isEdit"
            @update:modelValue="onScopeChange"
          />
        </div>
        <div>
          <div class="mb-1.5 text-sm text-ink-gray-5">{{ __('Description') }}</div>
          <FormControl
            v-model="draft.description"
            type="textarea"
            :placeholder="__('Optional')"
          />
        </div>
      </div>

      <!-- step 2: condition -->
      <div v-else-if="step === 2" class="flex flex-col gap-3">
        <div class="text-sm text-ink-gray-5">
          {{ __('Show records matching these conditions. Leave empty to include all.') }}
        </div>
        <div v-if="catalogReady">
          <Filter
            :doctype="drivingDoctype"
            :fields="filterFields"
            v-model="filterModel"
            @update="onFilterUpdate"
          />
          <div v-if="conditionCount" class="mt-2 text-xs text-ink-gray-5">
            {{ __('{0} condition(s) set', [conditionCount]) }}
          </div>
        </div>
        <div v-else class="text-sm text-ink-gray-4">{{ catalogHint }}</div>
      </div>

      <!-- step 3: columns -->
      <div v-else class="flex flex-col gap-3">
        <div class="text-sm text-ink-gray-5">
          {{ __('Choose and order the columns. Leave empty for the default set.') }}
        </div>
        <div v-if="catalogReady" class="flex flex-col gap-3">
          <ColumnSettings
            :doctype="drivingDoctype"
            :fieldSource="catalogFields"
            v-model="columnModel"
            @update="onColumnUpdate"
          />
          <div v-if="selectedColumns.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="key in selectedColumns"
              :key="key"
              class="rounded bg-surface-gray-2 px-2 py-0.5 text-xs text-ink-gray-7"
            >
              {{ labelFor(key) }}
            </span>
          </div>
          <div v-else class="text-xs text-ink-gray-4">
            {{ __('No columns chosen — the view will show its default columns.') }}
          </div>
        </div>
        <div v-else class="text-sm text-ink-gray-4">{{ catalogHint }}</div>
      </div>
    </template>

    <template #actions>
      <div class="flex items-center justify-between gap-2">
        <Button
          v-if="isEdit && draft.can_write"
          :label="__('Delete')"
          theme="red"
          variant="ghost"
          @click="confirmDelete"
        />
        <span v-else />
        <div class="flex gap-2">
          <Button v-if="step > 1" :label="__('Back')" @click="step--" />
          <Button
            v-if="step < 3"
            variant="solid"
            :label="__('Next')"
            :disabled="!canNext"
            @click="goNext"
          />
          <Button
            v-else
            variant="solid"
            :label="isEdit ? __('Save changes') : __('Create view')"
            :loading="saving"
            :disabled="!canSave"
            @click="save"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button, FormControl, createResource, call, toast } from 'frappe-ui'
import Filter from '@/components/Filter.vue'
import ColumnSettings from '@/components/ColumnSettings.vue'
import { createDialog } from '@/utils/dialogs'
import { filtersToPredicate, predicateToFilters } from '@/tatva/smartViewPredicate'
import { computed, reactive, ref, watch } from 'vue'

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
  predicate: null,
  columns: [],
  can_write: true,
})

const draft = reactive(blank())
const step = ref(1)
const furthestStep = ref(1)
const saving = ref(false)

const isEdit = computed(() => !!draft.name)
const titleText = computed(() => (isEdit.value ? __('Edit Smart View') : __('New Smart View')))
const drivingDoctype = computed(() =>
  draft.base_object === 'Activity' ? 'CRM Task' : 'CRM Lead',
)

// --- activity types (native select) ---------------------------------------
const taskTypes = createResource({
  url: 'frappe.client.get_list',
  makeParams: () => ({
    doctype: 'CRM Task Type',
    fields: ['name'],
    limit_page_length: 0,
    order_by: 'name asc',
  }),
})
const activityTypeOptions = computed(() =>
  (taskTypes.data || []).map((t) => ({ label: t.name, value: t.name })),
)

// --- the field catalog feeds BOTH native controls --------------------------
const catalog = createResource({
  url: 'tatva_connect.smartview.api.field_catalog',
  makeParams: () => ({
    base_object: draft.base_object,
    activity_type: draft.base_object === 'Activity' ? draft.activity_type || undefined : undefined,
  }),
})

const catalogReady = computed(() => {
  if (draft.base_object === 'Activity' && !draft.activity_type) return false
  return Array.isArray(catalog.data) && catalog.data.length > 0
})
const catalogHint = computed(() =>
  draft.base_object === 'Activity' && !draft.activity_type
    ? __('Pick an activity type first.')
    : __('Loading fields…'),
)

const toField = (c) => ({
  fieldname: c.field_key,
  label: c.label,
  fieldtype: c.fieldtype,
  options: c.options,
})
const catalogFields = computed(() => (catalog.data || []).map(toField))
const filterFields = computed(() =>
  (catalog.data || []).filter((c) => c.filterable).map(toField),
)
function labelFor(key) {
  return (catalog.data || []).find((c) => c.field_key === key)?.label || key
}

// --- the two native control models -----------------------------------------
const filterModel = ref({ data: {}, params: { filters: {} } })
const columnModel = ref({ data: { columns: [], rows: [] } })

function onFilterUpdate(dict) {
  filterModel.value.params.filters = dict || {}
}
function onColumnUpdate() {
  // ColumnSettings writes columnModel.value.data.columns directly via v-model; nothing to capture.
}

const conditionCount = computed(
  () => Object.keys(filterModel.value?.params?.filters || {}).length,
)
const selectedColumns = computed(() =>
  (columnModel.value?.data?.columns || []).map((c) => c.key),
)

// Build a native column object for a catalog key (matches ColumnSettings' own shape).
function columnObject(key) {
  const c = (catalog.data || []).find((f) => f.field_key === key)
  if (!c) return null
  const align = ['Float', 'Int', 'Percent', 'Currency', 'Duration'].includes(c.fieldtype)
    ? 'right'
    : 'left'
  return { key, label: c.label, type: c.fieldtype, options: c.options, width: '10rem', align }
}

// Seed the two control models from the draft, once the catalog for the current scope is loaded.
function seedModels() {
  filterModel.value = {
    data: {},
    params: { filters: predicateToFilters(draft.predicate) },
  }
  const cols = (draft.columns || []).map(columnObject).filter(Boolean)
  columnModel.value = { data: { columns: cols, rows: [] } }
}

// When the scope changes the available fields change — drop selections that no longer apply by
// re-seeding off the (now reloaded) catalog.
watch(
  () => catalog.data,
  (d) => {
    if (Array.isArray(d)) seedModels()
  },
)

function onScopeChange() {
  // a fresh scope invalidates the old predicate/columns
  draft.predicate = null
  draft.columns = []
  filterModel.value = { data: {}, params: { filters: {} } }
  columnModel.value = { data: { columns: [], rows: [] } }
  catalog.reload()
}

// --- step gating -----------------------------------------------------------
const canNext = computed(() => {
  if (step.value === 1) {
    if (!draft.label.trim()) return false
    if (draft.base_object === 'Activity' && !draft.activity_type) return false
    return true
  }
  return true
})
const canSave = computed(() => canNext.value)

function goNext() {
  if (!canNext.value) return
  step.value += 1
  if (step.value > furthestStep.value) furthestStep.value = step.value
}

// --- load on open ----------------------------------------------------------
watch(open, async (isOpen) => {
  if (!isOpen) return
  step.value = 1
  furthestStep.value = 1
  taskTypes.reload()
  Object.assign(draft, blank())
  filterModel.value = { data: {}, params: { filters: {} } }
  columnModel.value = { data: { columns: [], rows: [] } }
  if (props.viewName) {
    try {
      const d = await call('tatva_connect.smartview.api.get_view', { name: props.viewName })
      Object.assign(draft, {
        name: d.name,
        label: d.label || '',
        base_object: d.base_object || 'Lead',
        activity_type: d.activity_type || '',
        description: d.description || '',
        predicate: d.predicate || null,
        columns: d.columns || [],
        can_write: d.can_write,
      })
    } catch (e) {
      toast.error(__('Could not load this view.'))
      open.value = false
      return
    }
  }
  catalog.reload() // seedModels runs from the catalog watch once data lands
})

// --- save / delete ---------------------------------------------------------
async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    const payload = {
      name: draft.name || undefined,
      label: draft.label.trim(),
      base_object: draft.base_object,
      activity_type: draft.base_object === 'Activity' ? draft.activity_type : undefined,
      description: draft.description || undefined,
      predicate: filtersToPredicate(filterModel.value.params.filters),
      columns: selectedColumns.value,
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
