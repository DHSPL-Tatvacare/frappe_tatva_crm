<template>
  <ResponsiveDialog v-model="show" :options="{ size: '4xl' }">
    <template #body-title>
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold text-ink-gray-9">
          {{
            doc.title ||
            selectedTypeLabel ||
            (props.task?.name || name ? __('Task') : __('New Task'))
          }}
        </span>
        <span v-if="name" class="text-sm text-ink-gray-4">#{{ name }}</span>
      </div>
    </template>

    <template #body-content>
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center gap-3 py-12 text-xl font-medium text-ink-gray-6"
      >
        <LoadingIndicator class="h-6 w-6" />
        <span>{{ __('Loading...') }}</span>
      </div>
      <div
        v-else
        class="flex flex-col gap-5 overflow-y-auto pr-0.5 sm:max-h-[60vh] lg:overflow-hidden"
      >
        <div v-if="!editing && doc.status" class="flex items-center gap-2">
          <Badge
            v-if="doc.custom_task_type"
            variant="subtle"
            theme="gray"
            size="sm"
            :label="selectedTypeLabel || doc.custom_task_type"
          />
          <Badge
            variant="subtle"
            :theme="statusTheme(doc.status)"
            size="sm"
            :label="doc.status"
          />
        </div>

        <!-- Each pane scrolls inside the capped row; min-h-0 or a flex child refuses to shrink below its content. -->
        <div
          class="flex flex-col gap-5 lg:max-h-[60vh] lg:flex-row lg:items-stretch lg:gap-8"
        >
          <div
            class="flex min-w-0 flex-1 basis-0 flex-col gap-5 lg:min-h-0 lg:overflow-y-auto"
          >
            <div data-tc-std="title">
              <FormControl
                v-model="doc.title"
                :label="__('Title')"
                :placeholder="hint(__('Task title'), locked)"
                :disabled="locked"
              />
            </div>

            <div>
              <div class="mb-1.5 text-xs text-ink-gray-5">
                {{ __(notesLabel) }}
              </div>
              <TextEditorControl
                :value="doc.description"
                variant="outline"
                size="sm"
                :placeholder="hint(__('Add a description…'), locked)"
                :disabled="locked"
                :upload-function="stageInline"
                @change="doc.description = $event"
              />
            </div>

            <div v-if="showLeadLink">
              <div class="mb-1.5 text-xs text-ink-gray-5">
                {{ __('Link a lead') }}
              </div>
              <Link
                doctype="CRM Lead"
                :value="refDocname"
                :placeholder="hint(__('Search leads you can access…'), locked)"
                :disabled="locked"
                @change="(v) => (refDocname = v)"
              />
            </div>

            <div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <div class="mb-1.5 text-xs text-ink-gray-5">
                  {{ __('Status') }}
                </div>
                <FormControl
                  v-model="doc.status"
                  type="select"
                  :options="STATUS_OPTIONS"
                  :disabled="locked"
                />
              </div>
              <div>
                <div class="mb-1.5 text-xs text-ink-gray-5">
                  {{ __('Priority') }}
                </div>
                <FormControl
                  v-model="doc.priority"
                  type="select"
                  :options="PRIORITY_OPTIONS"
                  :disabled="locked"
                />
              </div>
              <div>
                <div class="mb-1.5 text-xs text-ink-gray-5">
                  {{ __('Due Date') }}
                </div>
                <DateTimePicker
                  :value="doc.due_date"
                  :format="datetimeFormat"
                  :placeholder="hint(__('Select date & time'), locked)"
                  :disabled="locked"
                  @change="(v) => (doc.due_date = v)"
                />
              </div>
              <div>
                <div class="mb-1.5 text-xs text-ink-gray-5">
                  {{ __('Start Date') }}
                </div>
                <DatePicker
                  :value="doc.start_date"
                  :format="dateFormat"
                  :placeholder="hint(__('Select date'), locked)"
                  :disabled="locked"
                  @change="(v) => (doc.start_date = v)"
                />
              </div>
              <div>
                <div class="mb-1.5 text-xs text-ink-gray-5">
                  {{ __('Assignee') }}
                </div>
                <Link
                  doctype="User"
                  :value="doc.assigned_to"
                  :placeholder="hint(__('Assign to…'), locked)"
                  :disabled="locked"
                  @change="(v) => (doc.assigned_to = v)"
                />
              </div>
              <div data-tc-typepicker>
                <div class="mb-1.5 text-xs text-ink-gray-5">
                  {{ __('Task Type') }}
                </div>
                <Autocomplete
                  :options="typeOptions"
                  value=""
                  :disabled="!leadName || locked"
                  @change="doc.custom_task_type = $event?.value || ''"
                >
                  <template #target="{ togglePopover, isOpen }">
                    <Button
                      class="w-full !justify-between"
                      :label="
                        selectedTypeLabel ||
                        (locked ? NOTHING : __('Select a task type…'))
                      "
                      :disabled="!leadName || locked"
                      :iconRight="isOpen ? 'chevron-up' : 'chevron-down'"
                      @click="togglePopover"
                    />
                  </template>
                </Autocomplete>
              </div>
            </div>
            <div v-if="loadedTask?.location">
              <div
                class="mb-1.5 flex items-start gap-1 text-xs text-ink-gray-5"
              >
                <span>📍</span
                ><span>{{
                  loadedTask.location.address || __('Visit location')
                }}</span>
              </div>
              <TatvaMiniMap
                v-if="mapConfig"
                :lat="loadedTask.location.lat"
                :lng="loadedTask.location.lng"
                :zoom="mapConfig.zoom"
                :provider="mapConfig.thumbnail"
                :tile-url="mapConfig.tile_url"
                class="h-44 w-full rounded-lg border border-outline-gray-1"
              />
            </div>
            <div
              v-else-if="config?.captures_location && editing"
              class="flex items-start gap-1.5 text-xs text-ink-gray-5"
            >
              <span>📍</span>
              <span>{{
                __(
                  'Your location will be captured and checked against the doctor when you save this visit.',
                )
              }}</span>
            </div>
            <div
              v-else-if="config?.captures_location"
              class="flex items-start gap-1.5 text-xs text-ink-gray-5"
            >
              <span>📍</span>
              <span>{{ __('No location was captured for this visit.') }}</span>
            </div>
          </div>

          <div
            v-if="formPane"
            class="flex min-w-0 flex-1 basis-0 flex-col gap-5 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-outline-gray-2 lg:pl-8 lg:pr-1"
          >
            <div
              v-if="!schemaFields.length && editing"
              class="flex flex-1 flex-col items-center justify-center gap-2 rounded border border-dashed border-outline-gray-2 p-6 text-center"
            >
              <FeatherIcon name="layout" class="h-5 w-5 text-ink-gray-4" />
              <div class="text-p-sm text-ink-gray-5">
                {{ __('Select a task type to display its fields') }}
              </div>
            </div>

            <!-- Hidden with v-show, never filtered out: a field keeps its column, its DOM node and the cursor in it. -->
            <template v-if="schemaFields.length">
              <!-- Tabs stay clickable when locked: switching tab is reading, not editing. -->
              <TabButtons
                v-if="tabButtons.length > 1"
                v-model="activeTab"
                :buttons="tabButtons"
                data-tc-tabs
              />
              <div
                v-for="tab in layout"
                v-show="tab.key === activeTab && visibility.tabs.has(tab.key)"
                :key="tab.key"
                :data-tc-tab="tab.key"
                class="flex flex-col gap-5"
              >
                <div
                  v-for="section in tab.sections"
                  v-show="visibility.sections.has(section.key)"
                  :key="section.key"
                  :data-tc-section="section.key"
                  class="flex flex-col gap-3"
                >
                  <div
                    v-if="section.label"
                    class="text-sm font-semibold text-ink-gray-8"
                  >
                    {{ __(section.label) }}
                  </div>
                  <div
                    class="flex flex-col gap-x-6 gap-y-4 sm:flex-row sm:items-start"
                  >
                    <div
                      v-for="column in section.columns"
                      v-show="visibility.columns.has(column.key)"
                      :key="column.key"
                      :data-tc-column="column.key"
                      class="flex min-w-0 flex-1 basis-0 flex-col gap-4"
                    >
                      <div v-if="column.label" class="text-sm text-ink-gray-6">
                        {{ __(column.label) }}
                      </div>
                      <div
                        v-for="f in column.fields"
                        v-show="
                          f.target !== 'description' &&
                          visibility.fields.has(f.fieldname)
                        "
                        :key="f.fieldname"
                        :data-tc-field="f.fieldname"
                        class="min-w-0"
                      >
                        <label class="mb-1.5 block text-sm text-ink-gray-5">
                          {{ __(f.label)
                          }}<span v-if="f.reqd" class="text-ink-red-3">*</span>
                        </label>
                        <div :class="control(f).wrap">
                          <component
                            :is="control(f).is"
                            v-if="control(f).vModel"
                            v-model="activity[f.fieldname]"
                            v-bind="bindControl(f)"
                          />
                          <component
                            :is="control(f).is"
                            v-else
                            :value="activity[f.fieldname]"
                            v-bind="bindControl(f)"
                            @change="(v) => (activity[f.fieldname] = v)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <ErrorMessage v-if="error" :message="error" />
      </div>
    </template>

    <template #actions>
      <div class="flex justify-end gap-2">
        <template v-if="editing">
          <Button
            :label="__('Cancel')"
            :disabled="submitting"
            @click="cancel"
          />
          <Button
            variant="solid"
            :label="saveLabel"
            :loading="submitting"
            @click="save"
          />
        </template>
        <template v-else>
          <Button
            :label="__('Edit')"
            iconLeft="edit-2"
            @click="editing = true"
          />
          <Button variant="solid" :label="__('Close')" @click="show = false" />
        </template>
      </div>
    </template>
  </ResponsiveDialog>

  <Dialog v-model="noticeOpen" :options="{ size: 'sm' }">
    <template #body-title>
      <span class="text-lg font-semibold text-ink-gray-9">
        {{
          notice?.kind === 'blocked'
            ? __('Too far from the doctor')
            : __('Visit location captured')
        }}
      </span>
    </template>
    <template #body-content>
      <TatvaMiniMap
        v-if="notice && mapConfig"
        :lat="notice.lat"
        :lng="notice.lng"
        :here="notice.here || null"
        :zoom="15"
        :provider="mapConfig.dialog"
        :tile-url="mapConfig.tile_url"
        class="mb-3 h-44 w-full rounded-lg border border-outline-gray-1"
      />
      <div v-if="notice?.kind === 'blocked'" class="text-sm text-ink-gray-7">
        {{
          __(
            'Reach within {0} of the doctor to log this visit — you are {1} away.',
            [
              formatDistance(notice.allowed_m),
              formatDistance(notice.distance_m),
            ],
          )
        }}
      </div>
      <div v-else class="text-sm text-ink-gray-7">
        {{ __('Logged at your current location.') }}
      </div>
      <div v-if="notice?.address" class="mt-2 text-xs text-ink-gray-5">
        📍 {{ notice.address }}
      </div>
    </template>
    <template #actions>
      <Button
        variant="solid"
        class="w-full"
        :label="__('Okay')"
        @click="noticeOpen = false"
      />
    </template>
  </Dialog>
</template>
<script setup>
import { settleVisible, withBlanks } from '@/tatva/activityVisibility'
import { control, controlBind, hint, NOTHING } from '@/tatva/activityControls'

import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Autocomplete,
  Dialog,
  Badge,
  Button,
  FormControl,
  DateTimePicker,
  DatePicker,
  ErrorMessage,
  LoadingIndicator,
  TabButtons,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import Link from '@/components/Controls/Link.vue'
import TextEditorControl from '@/components/Controls/TextEditorControl.vue'
import TatvaMiniMap from '@/tatva/TatvaMiniMap.vue'
import { useMapConfig } from '@/composables/mapConfig'
import { statusTheme } from '@/tatva/taskStatus.js'
import { useStagedAttachments } from '@/tatva/useStagedAttachments'
import { getFormat, formatDistance } from '@/utils'

const props = defineProps({
  task: { type: Object, default: null }, // existing task ({name, title, status, ..., values, location}) or null
  lead: { type: String, default: '' }, // lead/deal context; empty => standalone (show picker)
  referenceDoctype: { type: String, default: 'CRM Lead' }, // context doctype (CRM Lead | CRM Deal)
  defaultType: { type: String, default: '' }, // preselect a task type (composite PK) on create — the "Log Activity" direct path
  defaultDueDate: { type: String, default: '' }, // prefill the due datetime on create — the calendar's clicked cell
  mode: { type: String, default: 'view' }, // 'view' | 'edit' | 'create' | 'complete'
})

const show = defineModel({ type: Boolean, default: false })
const mapConfig = useMapConfig()
const emit = defineEmits(['saved'])

const { hasStaged, stageInline, uploadAllOwned, rewriteInline } =
  useStagedAttachments()

const STATUS_OPTIONS = ['Backlog', 'Todo', 'In Progress', 'Done', 'Canceled']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High']
const datetimeFormat = getFormat('', '', true, true, false)
const dateFormat = getFormat('', '', true, false, false)

const name = ref(null)
const doc = reactive({}) // standard CRM Task fields
const activity = reactive({}) // schema field values (for typed tasks)
const schemaFields = ref([]) // current type's schema
const config = ref(null)
const refDoctype = ref('CRM Lead') // the lead/deal this task is linked to
const refDocname = ref('') // ...its name
const loadedTask = ref(null) // full task from task_detail (values, location) when editing/viewing
const leadValues = ref({}) // the lead's CURRENT values for this type's source=Lead fields — prefill only
const loading = ref(!!props.task?.name)
// Set here, not in onMounted, or a create modal paints locked for one frame.
const editing = ref(props.mode !== 'view')
const submitting = ref(false)
const error = ref(null)
const notice = ref(null)

const showLeadLink = computed(() => !name.value && !props.lead)
const leadName = computed(() => refDocname.value)

// Reading locks the form; everything else opens it. "Log Activity" is this form with defaultType passed in.
const locked = computed(() => !editing.value)
const formPane = computed(() =>
  Boolean(
    schemaFields.value.length || loadedTask.value?.location || editing.value,
  ),
)

const types = createResource({
  url: 'tatva_connect.activity.api.list_types_for_lead',
  makeParams: () => ({ lead: leadName.value }),
  ...(props.lead ? { cache: ['tatva-task-types', props.lead] } : {}),
})
const typeOptions = computed(() =>
  (types.data || []).map((t) => ({
    label: t.label || t.name,
    value: t.name,
  })),
)
const selectedTypeLabel = computed(
  () =>
    (types.data || []).find((t) => t.name === doc.custom_task_type)?.label ||
    loadedTask.value?.task_type_label ||
    '',
)

watch(refDocname, () => {
  if (!showLeadLink.value) return
  doc.custom_task_type = ''
  if (leadName.value) types.reload()
})

watch(
  () => doc.custom_task_type,
  async (v) => {
    const origType = loadedTask.value?.task_type || ''
    if (v !== origType) {
      Object.keys(activity).forEach((k) => delete activity[k])
    }
    if (!v) {
      schemaFields.value = []
      config.value = null
      return
    }
    await loadSchema(v)
  },
)

const layout = computed(() => {
  const byName = Object.fromEntries(
    schemaFields.value.map((f) => [f.fieldname, f]),
  )
  return (config.value?.tabs || []).map((tab) => ({
    ...tab,
    sections: tab.sections.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        fields: column.fields.map((n) => byName[n]),
      })),
    })),
  }))
})

const liveValues = computed(() => withBlanks(schemaFields.value, activity))

const visibility = computed(() =>
  settleVisible(layout.value, schemaFields.value, liveValues.value),
)
const visibleSchemaFields = computed(() =>
  schemaFields.value.filter((f) => visibility.value.fields.has(f.fieldname)),
)

const activeTab = ref('')
// A tab with nothing shown offers nothing to click.
const tabButtons = computed(() =>
  layout.value
    .filter((t) => visibility.value.tabs.has(t.key))
    .map((t) => ({ label: t.label || __('Details'), value: t.key })),
)
watch(
  tabButtons,
  (buttons) => {
    if (!buttons.some((b) => b.value === activeTab.value))
      activeTab.value = buttons[0]?.value ?? ''
  },
  { immediate: true },
)

// The old flat read-only rendering lived here; the locked form reads `activity` through the one tree.
const notesField = computed(() =>
  schemaFields.value.find((f) => f.target === 'description'),
)
const notesLabel = computed(() => notesField.value?.label || 'Description')

// The declared field targeting `description` mirrors the editor rather than holding a second copy.
watch(
  [() => doc.description, notesField],
  ([text, field]) => {
    if (field) activity[field.fieldname] = text || ''
  },
  { immediate: true },
)

const saveLabel = computed(() => {
  if (name.value) return __('Save')
  return schemaFields.value.length ? __('Log Activity') : __('Create')
})

function isEmpty(v) {
  return v === null || v === undefined || v === ''
}

const STD_DEFAULTS = {
  title: '',
  description: '',
  status: 'Todo',
  priority: 'Low',
  due_date: '',
  start_date: '',
  assigned_to: '',
  custom_task_type: '',
}

function applyLoaded() {
  const t = loadedTask.value
  if (!t) return
  Object.assign(doc, {
    ...STD_DEFAULTS,
    title: t.title || '',
    description: t.description || '',
    status: t.status || 'Todo',
    priority: t.priority || 'Low',
    due_date: t.due_date || '',
    start_date: t.start_date || '',
    assigned_to: t.assigned_to || '',
    custom_task_type: t.task_type || '',
  })
  // Cleared key by key: every control is bound to this object, and a fresh one would leave them on the old.
  for (const k of Object.keys(activity)) delete activity[k]
  Object.assign(activity, { ...t.values })
  if (props.mode === 'complete') doc.status = 'Done'
}

onMounted(async () => {
  const rowType = props.task?.custom_task_type || props.task?.task_type || ''
  if (rowType) doc.custom_task_type = rowType

  if (props.task?.name) {
    let d
    try {
      d = await call('tatva_connect.activity.api.task_detail', {
        task: props.task.name,
      })
    } catch (e) {
      error.value =
        (e && (e.messages?.[0] || e.message)) || __('Could not load this task.')
      loading.value = false
      return
    }
    const t = d.task
    name.value = t.name
    loadedTask.value = t
    config.value = d.config
    schemaFields.value = d.config?.fields || []
    refDoctype.value = t.reference_doctype || 'CRM Lead'
    refDocname.value = t.reference_docname || ''
    applyLoaded()
  } else {
    name.value = null
    refDoctype.value = props.referenceDoctype || 'CRM Lead'
    refDocname.value = props.lead || ''
    Object.assign(doc, { ...STD_DEFAULTS })
    if (props.defaultType) doc.custom_task_type = props.defaultType
    if (props.defaultDueDate) doc.due_date = props.defaultDueDate
  }

  if (doc.custom_task_type) await loadSchema(doc.custom_task_type)
  loading.value = false

  if (leadName.value) types.reload()
})

// type_config is cached per type, shared by every task of that type.
function typeConfigResource(taskType, lead) {
  return createResource({
    url: 'tatva_connect.activity.api.type_config',
    params: { task_type: taskType, lead: lead || undefined },
    cache: ['tatva-type-config', taskType, lead || ''],
  })
}

async function loadSchema(taskType) {
  const r = typeConfigResource(taskType, leadName.value)
  if (!r.data) {
    try {
      // Opening reaches here twice; join the in-flight request instead of starting a second.
      await (r.loading && r.promise ? r.promise : r.fetch())
    } catch {
      schemaFields.value = []
      config.value = null
      return
    }
  }
  config.value = r.data || null
  schemaFields.value = r.data?.fields || []
  // Lead-sourced fields are context: shown read_only, snapshotted on save, never written back.
  leadValues.value = r.data?.lead_values || {}
  // Prefill, never overwrite: a value the rep already typed wins.
  for (const [k, v] of Object.entries(leadValues.value))
    if (isEmpty(activity[k])) activity[k] = v
}

const controlCtx = computed(() => ({
  __,
  optionList,
  dateFormat: dateFormat.value,
  datetimeFormat: datetimeFormat.value,
  leadName: leadName.value,
}))
const bindControl = (f) => controlBind(f, controlCtx.value, locked.value)

function optionList(f) {
  const opts = (f.options || '')
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean)
  return [
    { label: '', value: '' },
    ...opts.map((o) => ({ label: o, value: o })),
  ]
}

function getGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

async function resolveLocation(values) {
  const taskType = doc.custom_task_type
  let needed
  try {
    needed = await call('tatva_connect.location.api.location_needed', {
      lead: leadName.value,
      task_type: taskType,
      values: JSON.stringify(values),
    })
  } catch {
    return null
  }
  if (!needed) return null
  const pos = await getGPS()
  if (!pos) {
    toast.error(__('Allow location access to log this in-person visit.'))
    return 'abort'
  }
  let pre
  try {
    pre = await call('tatva_connect.location.api.precheck', {
      lead: leadName.value,
      task_type: taskType,
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      values: JSON.stringify(values),
      task: name.value || undefined,
    })
  } catch {
    toast.error(__("Couldn't verify your location — please try again."))
    return 'abort'
  }
  if (pre && pre.ok === false) {
    notice.value = {
      kind: 'blocked',
      lat: pre.anchor_lat,
      lng: pre.anchor_lng,
      here: { lat: pos.lat, lng: pos.lng },
      distance_m: pre.distance_m,
      allowed_m: pre.allowed_m,
      address: pre.anchor_address,
    }
    toast.error(
      __('You are {0} away — too far to log this visit.', [
        formatDistance(pre.distance_m),
      ]),
    )
    return 'abort'
  }
  return {
    lat: pos.lat,
    lng: pos.lng,
    accuracy: pos.accuracy,
    anchorAddress: pre?.anchor_address || '',
  }
}

function stdFields() {
  return {
    title: doc.title || selectedTypeLabel.value || '',
    description: doc.description || '',
    status: doc.status,
    priority: doc.priority,
    due_date: doc.due_date || null,
    start_date: doc.start_date || null,
    assigned_to: doc.assigned_to || null,
  }
}

async function save() {
  if (submitting.value) return
  error.value = null

  const isTyped = !!doc.custom_task_type && schemaFields.value.length > 0
  if (isTyped) {
    const missing = visibleSchemaFields.value.filter(
      (f) => f.reqd && isEmpty(activity[f.fieldname]),
    )
    if (missing.length) {
      error.value = __('Please fill: {0}', [
        missing.map((f) => f.label).join(', '),
      ])
      return
    }
    if (!leadName.value) {
      error.value = __('Link a lead to log an activity task.')
      return
    }
  }

  submitting.value = true
  try {
    let savedName = name.value

    if (isTyped) {
      const values = {}
      for (const f of visibleSchemaFields.value)
        values[f.fieldname] = activity[f.fieldname]

      const fix = await resolveLocation(values)
      if (fix === 'abort') return
      if (fix)
        Object.assign(values, {
          lat: fix.lat,
          lng: fix.lng,
          accuracy: fix.accuracy,
        })

      if (savedName) {
        await call('tatva_connect.activity.api.save_activity', {
          lead: leadName.value,
          task_type: doc.custom_task_type,
          values: JSON.stringify(values),
          task: savedName,
          task_fields: JSON.stringify(stdFields()),
        })
      } else {
        const computed = await call(
          'tatva_connect.activity.api.compute_activity_fields',
          {
            lead: leadName.value,
            task_type: doc.custom_task_type,
            values: JSON.stringify(values),
          },
        )
        const inserted = await call('frappe.client.insert', {
          doc: {
            doctype: 'CRM Task',
            ...stdFields(),
            custom_task_type: doc.custom_task_type,
            reference_doctype: refDoctype.value,
            reference_docname: leadName.value,
            ...computed,
          },
        })
        savedName = inserted.name
      }
      if (fix && fix.lat)
        notice.value = {
          kind: 'receipt',
          lat: fix.lat,
          lng: fix.lng,
          address: fix.anchorAddress,
        }
    } else {
      if (savedName) {
        await call('frappe.client.set_value', {
          doctype: 'CRM Task',
          name: savedName,
          fieldname: {
            ...stdFields(),
            custom_task_type: doc.custom_task_type || null,
          },
        })
      } else {
        const ref = leadName.value
          ? {
              reference_doctype: refDoctype.value,
              reference_docname: leadName.value,
            }
          : {}
        const inserted = await call('frappe.client.insert', {
          doc: {
            doctype: 'CRM Task',
            ...stdFields(),
            custom_task_type: doc.custom_task_type || null,
            ...ref,
          },
        })
        savedName = inserted.name
      }
    }

    if (hasStaged.value && savedName) {
      const rewrites = await uploadAllOwned({
        doctype: 'CRM Task',
        docname: savedName,
      })
      const newDesc = rewriteInline(doc.description, rewrites)
      if (newDesc !== doc.description) {
        doc.description = newDesc
        await call('frappe.client.set_value', {
          doctype: 'CRM Task',
          name: savedName,
          fieldname: { description: newDesc },
        })
      }
    }

    toast.success(name.value ? __('Task saved.') : __('Task created.'))
    emit('saved', savedName)
    if (notice.value?.kind !== 'receipt') show.value = false
  } catch (e) {
    error.value =
      (e && (e.messages?.[0] || e.message)) ||
      __('Could not save — please try again.')
    toast.error(error.value)
  } finally {
    submitting.value = false
  }
}

function cancel() {
  // Cancel restores the loaded values; without it an abandoned edit stays on screen looking saved.
  if (props.mode === 'view') {
    applyLoaded()
    error.value = null
    editing.value = false
  } else show.value = false
}

const noticeOpen = computed({
  get: () => !!notice.value,
  set: (v) => {
    if (v) return
    const wasReceipt = notice.value?.kind === 'receipt'
    notice.value = null
    if (wasReceipt) show.value = false
  },
})
</script>
