<!--
  TaskModal — the ONE native task modal: create / edit / view / complete, used from the lead Activity
  header, the task listing page, and the board. Replaces TatvaTaskModal + the task_activity.js form
  script. 100% native controls (FormControl, TextEditorControl, DateTimePicker, DatePicker, Link,
  AttachControl) so it looks identical to the native form. Contained body with internal scroll — no DOM
  height hack. NOTHING saves until the button is clicked.

  Standard CRM Task fields (title, description, status, priority, due/start date, assignee) are always
  shown. Picking a Task Type renders THAT type's schema fields (get_schema, depends_on-aware). Save:
    • Typed task (type has a schema): the activity flow — resolve location (only when the type needs it),
      then create = compute_activity_fields + native insert (standard + computed in one write); complete/
      update an existing one = save_activity(task=name). One brain; enforce_* server backstops still fire.
    • Plain task (no type / no schema): native CRM Task insert / set_value.
  Lead link: hidden when a lead/deal context is passed (implied); a scoped Link picker otherwise.

  Lives in tatva/ (additive).
-->
<template>
  <Dialog v-model="show" :options="{ size: 'lg' }">
    <template #body-title>
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold text-ink-gray-9">
          {{ doc.title || selectedTypeLabel || (name ? __('Task') : __('New Task')) }}
        </span>
        <span v-if="name" class="text-sm text-ink-gray-4">#{{ name }}</span>
      </div>
    </template>

    <template #body-content>
      <div class="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-0.5">
        <div v-if="!editing && doc.status" class="flex items-center gap-2">
          <Badge
            v-if="doc.custom_task_type"
            variant="subtle"
            theme="gray"
            size="sm"
            :label="selectedTypeLabel || doc.custom_task_type"
          />
          <Badge variant="subtle" :theme="statusTheme(doc.status)" size="sm" :label="doc.status" />
        </div>

        <!-- VIEW: read-only -->
        <template v-if="!editing">
          <div class="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
            <div v-if="doc.priority" class="min-w-0">
              <div class="mb-0.5 text-xs text-ink-gray-5">{{ __('Priority') }}</div>
              <div class="text-sm text-ink-gray-8">{{ doc.priority }}</div>
            </div>
            <div v-if="doc.due_date" class="min-w-0">
              <div class="mb-0.5 text-xs text-ink-gray-5">{{ __('Due') }}</div>
              <div class="text-sm text-ink-gray-8">{{ formatDate(doc.due_date) }}</div>
            </div>
            <div v-if="doc.assigned_to" class="min-w-0">
              <div class="mb-0.5 text-xs text-ink-gray-5">{{ __('Assignee') }}</div>
              <div class="text-sm text-ink-gray-8">{{ getUser(doc.assigned_to)?.full_name || doc.assigned_to }}</div>
            </div>
          </div>
          <div v-if="doc.description" class="min-w-0">
            <div class="mb-0.5 text-xs text-ink-gray-5">{{ __('Description') }}</div>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="prose-sm max-w-none text-ink-gray-8" v-html="sanitizeHTML(doc.description)" />
          </div>

          <!-- saved activity values -->
          <div v-if="savedRows.length" class="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
            <div v-for="r in savedRows" :key="r.label" class="min-w-0">
              <div class="mb-0.5 text-xs text-ink-gray-5">{{ __(r.label) }}</div>
              <a
                v-if="isAttach(r.fieldtype)"
                :href="r.value"
                target="_blank"
                rel="noopener noreferrer"
                class="break-all text-sm text-ink-gray-8 underline"
              >{{ fileName(r.value) }}</a>
              <div v-else class="break-words text-sm text-ink-gray-8">{{ r.value }}</div>
            </div>
          </div>
          <div v-if="savedNotes">
            <div class="mb-0.5 text-xs text-ink-gray-5">{{ __('Notes') }}</div>
            <div class="whitespace-pre-wrap break-words text-sm text-ink-gray-8">{{ savedNotes }}</div>
          </div>
          <div v-if="loadedTask?.location">
            <div class="mb-1.5 flex items-start gap-1 text-xs text-ink-gray-5">
              <span>📍</span><span>{{ loadedTask.location.address || __('Visit location') }}</span>
            </div>
            <TatvaMiniMap
              :lat="loadedTask.location.lat"
              :lng="loadedTask.location.lng"
              :zoom="mapConfig.zoom || 16"
              :provider="mapConfig.thumbnail"
              :tile-url="mapConfig.tile_url"
              class="h-44 w-full rounded-lg border border-outline-gray-1"
            />
          </div>
        </template>

        <!-- CREATE / EDIT / LOG / COMPLETE: editable -->
        <template v-else>
          <!-- Standard task fields — only on the free-flow New Task / edit path. "Log Activity" and
               "Complete" are schema-ONLY (just the type's form + dependent setup), as the rep expects. -->
          <template v-if="!schemaOnly">
          <FormControl
            v-model="doc.title"
            :label="__('Title')"
            :placeholder="__('Task title')"
          />

          <div>
            <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Description') }}</div>
            <TextEditorControl
              :value="doc.description"
              variant="outline"
              size="sm"
              :placeholder="__('Add a description…')"
              @change="doc.description = $event"
            />
          </div>

          <!-- Lead link only when no lead/deal context was passed. -->
          <div v-if="showLeadLink">
            <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Link a lead') }}</div>
            <Link
              doctype="CRM Lead"
              :value="refDocname"
              :placeholder="__('Search leads you can access…')"
              @change="(v) => (refDocname = v)"
            />
          </div>

          <!-- Native switches, as-is -->
          <div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Status') }}</div>
              <FormControl type="select" :options="STATUS_OPTIONS" v-model="doc.status" />
            </div>
            <div>
              <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Priority') }}</div>
              <FormControl type="select" :options="PRIORITY_OPTIONS" v-model="doc.priority" />
            </div>
            <div>
              <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Due Date') }}</div>
              <DateTimePicker
                :value="doc.due_date"
                :format="datetimeFormat"
                :placeholder="__('Select date & time')"
                @change="(v) => (doc.due_date = v)"
              />
            </div>
            <div>
              <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Start Date') }}</div>
              <DatePicker
                :value="doc.start_date"
                :format="dateFormat"
                :placeholder="__('Select date')"
                @change="(v) => (doc.start_date = v)"
              />
            </div>
            <div>
              <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Assignee') }}</div>
              <Link
                doctype="User"
                :value="doc.assigned_to"
                :placeholder="__('Assign to…')"
                @change="(v) => (doc.assigned_to = v)"
              />
            </div>
            <div>
              <div class="mb-1.5 text-xs text-ink-gray-5">{{ __('Task Type') }}</div>
              <!-- Grain-scoped to the lead (invariant 9) — NOT a generic Link, which would offer
                   out-of-scope types that the server rejects. -->
              <FormControl
                type="select"
                :options="typeOptions"
                v-model="doc.custom_task_type"
                :disabled="!leadName"
              />
            </div>
          </div>
          </template>

          <!-- The chosen type's schema fields -->
          <template v-if="schemaFields.length">
            <div v-if="!schemaOnly" class="h-px bg-outline-gray-modals" />
            <div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div v-for="f in visibleSchemaFields" :key="f.fieldname" class="min-w-0">
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __(f.label) }}<span v-if="f.reqd" class="text-ink-red-3">*</span>
                </label>
                <FormControl
                  v-if="f.fieldtype === 'Select'"
                  type="select"
                  :options="optionList(f)"
                  v-model="activity[f.fieldname]"
                />
                <DateTimePicker
                  v-else-if="f.fieldtype === 'Datetime'"
                  :value="activity[f.fieldname]"
                  :format="datetimeFormat"
                  :placeholder="__('Select date & time')"
                  @change="(v) => (activity[f.fieldname] = v)"
                />
                <DatePicker
                  v-else-if="f.fieldtype === 'Date'"
                  :value="activity[f.fieldname]"
                  :format="dateFormat"
                  :placeholder="__('Select date')"
                  @change="(v) => (activity[f.fieldname] = v)"
                />
                <Link
                  v-else-if="f.fieldtype === 'Link' || f.fieldtype === 'User'"
                  :value="activity[f.fieldname]"
                  :doctype="f.fieldtype === 'User' ? 'User' : f.options || 'User'"
                  :placeholder="__('Select {0}', [f.label])"
                  @change="(v) => (activity[f.fieldname] = v)"
                />
                <div v-else-if="f.fieldtype === 'Check'" class="flex h-8 items-center">
                  <FormControl type="checkbox" v-model="activity[f.fieldname]" />
                </div>
                <FormControl
                  v-else-if="['Small Text', 'Text', 'Long Text'].includes(f.fieldtype)"
                  type="textarea"
                  v-model="activity[f.fieldname]"
                />
                <AttachControl
                  v-else-if="isAttach(f.fieldtype)"
                  :value="activity[f.fieldname]"
                  doctype="CRM Lead"
                  :docname="leadName"
                  :imageOnly="f.fieldtype === 'Attach Image'"
                  @change="(url) => (activity[f.fieldname] = url)"
                />
                <FormControl v-else type="text" v-model="activity[f.fieldname]" />
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-sm text-ink-gray-5">{{ __('Notes') }}</label>
              <FormControl type="textarea" v-model="activity.notes" :placeholder="__('Optional notes')" />
            </div>
            <div v-if="config?.captures_location" class="flex items-start gap-1.5 text-xs text-ink-gray-5">
              <span>📍</span>
              <span>{{ __('Your location will be captured and checked against the doctor when you save this visit.') }}</span>
            </div>
          </template>

          <ErrorMessage v-if="error" :message="error" />
        </template>
      </div>
    </template>

    <template #actions>
      <div class="flex justify-end gap-2">
        <template v-if="editing">
          <Button :label="__('Cancel')" :disabled="submitting" @click="cancel" />
          <Button variant="solid" :label="saveLabel" :loading="submitting" @click="save" />
        </template>
        <template v-else>
          <Button :label="__('Edit')" iconLeft="edit-2" @click="editing = true" />
          <Button variant="solid" :label="__('Close')" @click="show = false" />
        </template>
      </div>
    </template>
  </Dialog>

  <!-- Out-of-range block + capture receipt (server static_map proxy, key-safe) -->
  <Dialog v-model="noticeOpen" :options="{ size: 'sm' }">
    <template #body-title>
      <span class="text-lg font-semibold text-ink-gray-9">
        {{ notice?.kind === 'blocked' ? __('Too far from the doctor') : __('Visit location captured') }}
      </span>
    </template>
    <template #body-content>
      <TatvaMiniMap
        v-if="notice"
        :lat="notice.lat"
        :lng="notice.lng"
        :here="notice.here || null"
        :zoom="15"
        :provider="mapConfig.dialog"
        :tile-url="mapConfig.tile_url"
        class="mb-3 h-44 w-full rounded-lg border border-outline-gray-1"
      />
      <div v-if="notice?.kind === 'blocked'" class="text-sm text-ink-gray-7">
        {{ __('Reach within {0} m of the doctor to log this visit — you are {1} m away.', [notice.allowed_m, notice.distance_m]) }}
        <div v-if="notice.address" class="mt-2 text-xs text-ink-gray-5">📍 {{ notice.address }}</div>
      </div>
      <div v-else class="text-sm text-ink-gray-7">{{ __('Logged at your current location.') }}</div>
    </template>
    <template #actions>
      <Button variant="solid" class="w-full" :label="__('Okay')" @click="noticeOpen = false" />
    </template>
  </Dialog>
</template>
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Dialog, Badge, Button, FormControl, DateTimePicker, DatePicker, ErrorMessage, createResource, call, toast } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import TextEditorControl from '@/components/Controls/TextEditorControl.vue'
import AttachControl from '@/components/Controls/AttachControl.vue'
import TatvaMiniMap from '@/tatva/TatvaMiniMap.vue'
import { displayFileName } from '@/tatva/files'
import { evaluateDependsOnValue, getFormat, formatDate, sanitizeHTML } from '@/utils'
import { usersStore } from '@/stores/users'

const props = defineProps({
  task: { type: Object, default: null }, // existing task ({name, title, status, ..., values, location}) or null
  config: { type: Object, default: null }, // type_config for the task's type (view) — optional
  lead: { type: String, default: '' }, // lead/deal context; empty => standalone (show picker)
  referenceDoctype: { type: String, default: 'CRM Lead' }, // context doctype (CRM Lead | CRM Deal)
  defaultType: { type: String, default: '' }, // preselect a task type (composite PK) on create — the "Log Activity" direct path
  mode: { type: String, default: 'view' }, // 'view' | 'edit' | 'create' | 'complete'
  mapConfig: {
    type: Object,
    default: () => ({ thumbnail: 'osm', dialog: 'google', zoom: 16, tile_url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }),
  },
})

const show = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['saved'])

const { getUser } = usersStore()

const STATUS_OPTIONS = ['Backlog', 'Todo', 'In Progress', 'Done', 'Canceled']
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High']
const datetimeFormat = getFormat('', '', true, true, false)
const dateFormat = getFormat('', '', true, false, false)

const name = ref(null)
const doc = reactive({}) // standard CRM Task fields
const activity = reactive({}) // schema field values (for typed tasks)
const schemaFields = ref([]) // current type's schema
const config = ref(props.config)
const refDoctype = ref('CRM Lead') // the lead/deal this task is linked to
const refDocname = ref('') // ...its name
const loadedTask = ref(null) // full task from task_detail (values, location) when editing/viewing
const editing = ref(false)
const submitting = ref(false)
const error = ref(null)
const notice = ref(null)

// Lead picker only when creating a brand-new task with no context (e.g. the task listing page).
const showLeadLink = computed(() => !name.value && !props.lead)
const leadName = computed(() => refDocname.value)
// "Log Activity" + "Complete" are SCHEMA-ONLY: just the activity type's form (+ dependent setup,
// notes, location) — no standard task fields. New Task / edit show the full form.
const schemaOnly = computed(() => props.mode === 'log' || props.mode === 'complete')

// Grain-scoped task types for THIS lead (invariant 9 — the server filters by the lead's vertical/group/
// program; a generic Link would offer types compute_activity then rejects as out-of-scope).
const types = createResource({
  url: 'tatva_connect.activity.api.list_types_for_lead',
  makeParams: () => ({ lead: leadName.value }),
})
const typeOptions = computed(() => [
  { label: __('Select a task type…'), value: '' },
  ...(types.data || []).map((t) => ({ label: t.label || t.name, value: t.name })),
])
// The chosen type's clean label (type_name) — never the composite PK. Title falls back to this.
const selectedTypeLabel = computed(
  () =>
    (types.data || []).find((t) => t.name === doc.custom_task_type)?.label || '',
)

// Re-scope the types when the linked lead changes (standalone picker); clear a now-invalid type.
watch(refDocname, () => {
  if (!showLeadLink.value) return
  doc.custom_task_type = ''
  if (leadName.value) types.reload()
})

// Load the chosen type's schema reactively (v-model select; reka combobox has no usable change event).
// Keep seeded activity values when the type still matches the task being edited; clear on a real switch.
watch(
  () => doc.custom_task_type,
  async (v) => {
    const origType = loadedTask.value?.task_type || ''
    if (v !== origType) {
      Object.keys(activity).forEach((k) => delete activity[k])
    }
    schemaFields.value = []
    config.value = null
    if (v) await loadSchema(v)
  },
)

const visibleSchemaFields = computed(() =>
  schemaFields.value.filter((f) => !f.depends_on || evaluateDependsOnValue(f.depends_on, activity)),
)

// VIEW: saved activity values, depends_on-filtered, non-empty.
const savedValues = computed(() => loadedTask.value?.values || {})
const savedRows = computed(() =>
  schemaFields.value
    .filter((f) => !f.depends_on || evaluateDependsOnValue(f.depends_on, savedValues.value))
    .map((f) => ({ label: f.label, value: savedValues.value[f.fieldname], fieldtype: f.fieldtype }))
    .filter((r) => !isEmpty(r.value)),
)
const savedNotes = computed(() => savedValues.value.notes || '')

const saveLabel = computed(() => {
  if (name.value) return __('Save')
  return schemaFields.value.length ? __('Log Activity') : __('Create')
})

function isAttach(ft) {
  return ft === 'Attach' || ft === 'Attach Image'
}
function fileName(url) {
  return displayFileName(url)
}
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

watch(
  show,
  async (open) => {
    if (!open) return
    editing.value = props.mode !== 'view'
    error.value = null
    notice.value = null
    config.value = null
    loadedTask.value = null
    Object.keys(doc).forEach((k) => delete doc[k])
    Object.keys(activity).forEach((k) => delete activity[k])
    schemaFields.value = []

    if (props.task?.name) {
      // Load the FULL task by name (the board/listing pass a partial card or just {name}). One server
      // call, permission-checked (CRM Task read), with the activity values + location already parsed.
      let d
      try {
        d = await call('tatva_connect.activity.api.task_detail', { task: props.task.name })
      } catch (e) {
        error.value = (e && (e.messages?.[0] || e.message)) || __('Could not load this task.')
        return
      }
      const t = d.task
      name.value = t.name
      loadedTask.value = t
      config.value = d.config
      refDoctype.value = t.reference_doctype || 'CRM Lead'
      refDocname.value = t.reference_docname || ''
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
      Object.assign(activity, { ...(t.values || {}) })
      // "Complete" (Done picked on the board) → mark Done; the activity log + enforce_* run on save.
      if (props.mode === 'complete') doc.status = 'Done'
    } else {
      // Create: seed empty, take the lead/deal from the caller's context (or the picker, standalone).
      name.value = null
      refDoctype.value = props.referenceDoctype || 'CRM Lead'
      refDocname.value = props.lead || ''
      Object.assign(doc, { ...STD_DEFAULTS })
      // "Log Activity" direct path: preselect the chosen type so its schema renders immediately.
      if (props.defaultType) doc.custom_task_type = props.defaultType
    }

    // scope the type list to this lead; the doc.custom_task_type watcher loads the schema.
    if (leadName.value) types.reload()
  },
  { immediate: true },
)

async function loadSchema(taskType) {
  try {
    schemaFields.value = (await call('tatva_connect.activity.api.get_schema', { task_type: taskType })) || []
    config.value = await call('tatva_connect.activity.api.type_config', { task_type: taskType })
  } catch {
    schemaFields.value = []
    config.value = null
  }
}

function optionList(f) {
  const opts = (f.options || '').split('\n').map((o) => o.trim()).filter(Boolean)
  return [{ label: '', value: '' }, ...opts.map((o) => ({ label: o, value: o }))]
}

function statusTheme(status) {
  return (
    { Done: 'green', Canceled: 'red', 'In Progress': 'blue', Todo: 'orange', Backlog: 'gray' }[status] || 'gray'
  )
}

function getGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

// Location lifecycle (only fires when the type needs it). Returns fix | null (not needed) | 'abort'.
async function resolveLocation(values) {
  const taskType = doc.custom_task_type
  let needed = false
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
    toast.error(__('You are {0} m away — too far to log this visit.', [pre.distance_m]))
    return 'abort'
  }
  return { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy }
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
  // required schema fields
  if (isTyped) {
    const missing = visibleSchemaFields.value.filter((f) => f.reqd && isEmpty(activity[f.fieldname]))
    if (missing.length) {
      error.value = __('Please fill: {0}', [missing.map((f) => f.label).join(', ')])
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
      for (const f of visibleSchemaFields.value) values[f.fieldname] = activity[f.fieldname]
      if (activity.notes) values.notes = activity.notes

      const fix = await resolveLocation(values)
      if (fix === 'abort') return
      if (fix) Object.assign(values, fix)

      if (savedName) {
        // existing typed task: persist standard edits, then the activity (one brain).
        await call('frappe.client.set_value', {
          doctype: 'CRM Task',
          name: savedName,
          fieldname: stdFields(),
        })
        await call('tatva_connect.activity.api.save_activity', {
          lead: leadName.value,
          task_type: doc.custom_task_type,
          values: JSON.stringify(values),
          task: savedName,
        })
      } else {
        // new typed task: compute activity fields, then ONE native insert with standard + computed.
        const computed = await call('tatva_connect.activity.api.compute_activity_fields', {
          lead: leadName.value,
          task_type: doc.custom_task_type,
          values: JSON.stringify(values),
        })
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
      if (fix && fix.lat) notice.value = { kind: 'receipt', lat: fix.lat, lng: fix.lng }
    } else {
      // plain task
      if (savedName) {
        await call('frappe.client.set_value', {
          doctype: 'CRM Task',
          name: savedName,
          fieldname: { ...stdFields(), custom_task_type: doc.custom_task_type || null },
        })
      } else {
        const ref = leadName.value
          ? { reference_doctype: refDoctype.value, reference_docname: leadName.value }
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

    toast.success(name.value ? __('Task saved.') : __('Task created.'))
    emit('saved', savedName)
    show.value = false
  } catch (e) {
    error.value = (e && (e.messages?.[0] || e.message)) || __('Could not save — please try again.')
    toast.error(error.value)
  } finally {
    submitting.value = false
  }
}

function cancel() {
  if (props.mode === 'view') editing.value = false
  else show.value = false
}

const noticeOpen = computed({
  get: () => !!notice.value,
  set: (v) => {
    if (!v) notice.value = null
  },
})
</script>
