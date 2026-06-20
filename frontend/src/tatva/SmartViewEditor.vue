<!--
  TATVA: SmartViewEditor — the authoring modal for Smart Views (create / edit / delete). A wider
  frappe-ui Dialog with a 3-step build journey, using INLINE generic builders (popover controls
  spill outside a modal, so we don't embed them here):

    1. Details   — name, type (Lead/Activity), activity type, description (frappe-ui FormControl).
    2. Condition — ConditionBuilder (generic, inline): rows of field/operator/value over the
                   field_catalog; emits the composer predicate tree directly.
    3. Columns   — ColumnManager (generic, two-panel): search + checkbox list of all fields, and a
                   drag-reorderable selected list; emits the ordered column keys directly.

  Save goes through tatva_connect.smartview.api.upsert_view (catalog-validated, owner-scoped, capped);
  delete through delete_view (owner-scoped) behind the native confirm dialog. The editor never trusts
  itself — the server re-validates every field and the ownership rule on every write.
-->
<template>
  <!-- disableOutsideClickToClose: don't discard a half-built view on a stray background click. -->
  <Dialog
    v-model="open"
    :options="{ size: '4xl', title: titleText }"
    :disableOutsideClickToClose="true"
  >
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

      <!-- step 2: condition (inline builder — no popover escapes the modal) -->
      <div v-else-if="step === 2" class="flex flex-col gap-3">
        <div class="text-sm text-ink-gray-5">
          {{ __('Show records matching these conditions. Leave empty to include all.') }}
        </div>
        <ConditionBuilder v-if="catalogReady" :fields="filterFields" v-model="predicate" />
        <div v-else class="text-sm text-ink-gray-4">{{ catalogHint }}</div>
      </div>

      <!-- step 3: columns (two-panel manager) -->
      <div v-else class="flex flex-col gap-3">
        <div class="text-sm text-ink-gray-5">
          {{ __('Choose and order the columns. Leave empty for the default set.') }}
        </div>
        <ColumnManager v-if="catalogReady" :fields="catalogFields" v-model="columnKeys" />
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
import ConditionBuilder from '@/tatva/ConditionBuilder.vue'
import ColumnManager from '@/tatva/ColumnManager.vue'
import { createDialog } from '@/utils/dialogs'
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
// ColumnManager wants every field; ConditionBuilder wants the filterable ones. Both take the
// generic {fieldname, label, fieldtype, options} shape — field_key IS the identifier.
const catalogFields = computed(() => (catalog.data || []).map(toField))
const filterFields = computed(() =>
  (catalog.data || []).filter((c) => c.filterable).map(toField),
)

// The two bound values: the predicate tree (ConditionBuilder) and the ordered column keys
// (ColumnManager). These ARE the saved shapes — no conversion needed.
const predicate = ref(null)
const columnKeys = ref([])

// Seed both from the draft once the catalog for the current scope is loaded (so ColumnManager can
// resolve labels and ConditionBuilder can resolve fieldtypes). Drops keys not in the new scope.
function seedFromDraft() {
  predicate.value = draft.predicate || null
  const valid = new Set((catalog.data || []).map((c) => c.field_key))
  columnKeys.value = (draft.columns || []).filter((k) => valid.has(k))
}
watch(
  () => catalog.data,
  (d) => {
    if (Array.isArray(d)) seedFromDraft()
  },
)

function onScopeChange() {
  // a fresh scope invalidates the old predicate/columns
  draft.predicate = null
  draft.columns = []
  predicate.value = null
  columnKeys.value = []
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
  predicate.value = null
  columnKeys.value = []
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
