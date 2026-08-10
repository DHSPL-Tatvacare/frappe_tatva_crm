<template>
  <!-- One column, always — a plan and a punch are the two halves of one axis, never side by side. `snap`
       because the schema arrives after open (H6). -->
  <ResponsiveDialog v-model="show" :options="{ size: '2xl' }">
    <template #body-title>
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold text-ink-gray-9">
          {{
            doc.title ||
            selectedTypeLabel ||
            (props.task?.name || name ? __('Task') : __('New Task'))
          }}
        </span>
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
      <!-- The cap scrolls at every width it caps; `sm:` only, never paired with an lg override (H8/H9).
           `p-1 -m-1` is the FOCUS RING's room: frappe-ui draws it with `focus-visible:ring-2`, which is a
           box-shadow OUTSIDE the control, and a scroll container clips in both axes — so the ring was being
           sliced off against the shell on every field at an edge. The padding gives it 4px, the matching
           negative margin gives that space back, so nothing moves. -->
      <template v-else>
        <!-- Who this row is, pinned OUTSIDE the scroll box: type · clock · state · owner, identical in view and edit, and never editable here — the fields below own the editing. -->
        <div
          v-if="isExisting"
          class="mb-5 flex flex-wrap items-center gap-2 text-sm text-ink-gray-5"
          data-tc-facts
        >
          <Badge
            v-if="doc.custom_task_type"
            variant="subtle"
            theme="gray"
            size="sm"
            :label="selectedTypeLabel || doc.custom_task_type"
          />
          <!-- Content yields (H2): these truncate on a phone rather than push the line apart. -->
          <span v-if="rowClock" class="min-w-0 truncate">{{ rowClock }}</span>
          <!-- ONE state pill, never two: how it stands against its clock while it is open, how it ENDED once it is not. -->
          <Badge
            v-if="stateBadge"
            variant="subtle"
            :theme="stateBadge.theme"
            size="sm"
            :label="stateBadge.label"
          />
          <span v-if="assignee" class="flex min-w-0 items-center gap-1.5">
            <Avatar :label="assignee.label" :image="assignee.image" size="xs" />
            <span class="truncate">{{ assignee.label }}</span>
          </span>
        </div>

        <div
          class="-m-1 flex flex-col gap-5 overflow-y-auto p-1 sm:max-h-[calc(60vh+0.5rem)]"
          data-tc-body
        >
          <div class="flex flex-col gap-5">
            <!-- THE APPOINTMENT — what was promised. Present iff someone actually promised it, in view and in
                 edit alike, and never behind a disclosure: it is the reason the task exists. -->
            <div
              v-if="hasAppointment"
              class="flex min-w-0 flex-col gap-5"
              data-tc-appointment
            >
              <div data-tc-std="title">
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __('Title') }}
                </label>
                <FormControl
                  v-model="doc.title"
                  :placeholder="hint(__('Task title'), locked)"
                  variant="subtle"
                  :disabled="locked"
                />
              </div>

              <div>
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __(notesLabel) }}
                </label>
                <TextEditorControl
                  :value="doc.description"
                  variant="subtle"
                  size="sm"
                  :placeholder="hint(__('Add a description…'), locked)"
                  :disabled="locked"
                  :upload-function="stageInline"
                  @change="doc.description = $event"
                />
              </div>

              <div v-if="showLeadLink">
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __('Link a lead') }}
                </label>
                <Link
                  doctype="CRM Lead"
                  :value="refDocname"
                  :placeholder="
                    hint(__('Search leads you can access…'), locked)
                  "
                  variant="subtle"
                  :disabled="locked"
                  @change="(v) => (refDocname = v)"
                />
              </div>
            </div>

            <div
              v-if="hasAppointment"
              class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2"
            >
              <!-- Every attribute renders in every state — a locked blank reads `—`, it does not leave a hole. What a rep may CHANGE is said by the muted state, never by the field being absent. -->
              <div>
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __('Status') }}
                </label>
                <FormControl
                  v-model="doc.status"
                  type="select"
                  :options="STATUS_OPTIONS"
                  variant="subtle"
                  :disabled="locked"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __('Priority') }}
                </label>
                <FormControl
                  v-model="doc.priority"
                  type="select"
                  :options="PRIORITY_OPTIONS"
                  variant="subtle"
                  :disabled="locked"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __('Due Date') }}
                </label>
                <DateTimePicker
                  :value="doc.due_date"
                  :format="datetimeFormat"
                  :placeholder="hint(__('Select date & time'), locked)"
                  variant="subtle"
                  :disabled="locked"
                  @change="(v) => (doc.due_date = v)"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __('Start Date') }}
                </label>
                <DatePicker
                  :value="doc.start_date"
                  :format="dateFormat"
                  :placeholder="hint(__('Select date'), locked)"
                  variant="subtle"
                  :disabled="locked"
                  @change="(v) => (doc.start_date = v)"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __('Assignee') }}
                </label>
                <Link
                  doctype="User"
                  :value="doc.assigned_to"
                  :placeholder="hint(__('Assign to…'), locked)"
                  variant="subtle"
                  :disabled="locked"
                  @change="(v) => (doc.assigned_to = v)"
                />
              </div>
              <!-- A row that already NAMES a type does not offer to change it — the answers on screen belong to that type — but it still SHOWS it, muted, in the slot it has in every other state. -->
              <div data-tc-typepicker>
                <label class="mb-1.5 block text-sm text-ink-gray-5">
                  {{ __('Task Type') }}
                </label>
                <!-- Read off the type's own label, never `displayValue`, which falls back to the composite key for a type the lead can no longer be given. -->
                <FormControl
                  v-if="typeIsFixed"
                  :modelValue="selectedTypeLabel || NOTHING"
                  variant="subtle"
                  disabled
                />
                <Autocomplete
                  v-else
                  :options="typeOptions"
                  :value="doc.custom_task_type"
                  variant="subtle"
                  :placeholder="hint(__('Select a task type…'), locked)"
                  :disabled="!leadName || locked"
                  @change="doc.custom_task_type = $event?.value || ''"
                />
              </div>
            </div>
            <div v-if="loadedTask?.location">
              <div
                class="mb-1.5 flex items-start gap-1.5 text-xs text-ink-gray-5"
              >
                <FeatherIcon name="map-pin" class="h-3.5 w-3.5 shrink-0" />
                <span>{{
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
              <FeatherIcon name="map-pin" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
              <FeatherIcon name="map-pin" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{{ __('No location was captured for this visit.') }}</span>
            </div>

            <!-- THE RECORD — what happened, as the type declares it. -->
            <div
              v-if="hasRecord"
              class="flex min-w-0 flex-col gap-5"
              data-tc-record
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
                        <div
                          v-if="column.label"
                          class="text-sm text-ink-gray-6"
                        >
                          {{ __(column.label) }}
                        </div>
                        <!-- Notes is the plan pane's editor; with no plan pane it renders here like any other answer. -->
                        <div
                          v-for="f in column.fields"
                          v-show="
                            (f.target !== 'description' || !hasAppointment) &&
                            visibility.fields.has(f.fieldname)
                          "
                          :key="f.fieldname"
                          :data-tc-field="f.fieldname"
                          class="min-w-0"
                        >
                          <label class="mb-1.5 block text-sm text-ink-gray-5">
                            {{ __(f.label)
                            }}<span v-if="isRequired(f)" class="text-ink-red-3"
                              >*</span
                            >
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
        </div>
      </template>
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
        <!-- The solid button is the one that DOES something. Close was solid, so the loudest control on a
             read screen was the one that changes nothing. -->
        <template v-else>
          <Button :label="__('Close')" @click="show = false" />
          <Button
            variant="solid"
            :label="__('Edit')"
            iconLeft="edit-2"
            @click="editing = true"
          />
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
        {{ notice.address }}
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
import {
  copiedValues,
  requiredHere,
  settleVisible,
  withBlanks,
} from '@/tatva/activityVisibility'
import { control, controlBind, hint, NOTHING } from '@/tatva/activityControls'

import { computed, onMounted, provide, reactive, ref, watch } from 'vue'
import {
  Autocomplete,
  Avatar,
  Dialog,
  Badge,
  Button,
  FormControl,
  DateTimePicker,
  DatePicker,
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
import { dueBadge } from '@/tatva/taskDue.js'
import { useStagedAttachments } from '@/tatva/useStagedAttachments'
import { getFormat, formatDate, formatDistance } from '@/utils'
import { usersStore } from '@/stores/users'

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

// TATVA: the same `File::<url>` map a document ships, so an Attach control here reads the real name; it rides on task_detail, nothing extra is fetched.
const linkTitles = computed(() =>
  Object.fromEntries(
    Object.entries(loadedTask.value?.file_names || {}).map(([url, label]) => [
      `File::${url}`,
      label,
    ]),
  ),
)
provide('linkTitles', linkTitles)
const leadValues = ref({}) // the lead's CURRENT values for this type's source=Lead fields — prefill only
const loading = ref(!!props.task?.name)
// Set here, not in onMounted, or a create modal paints locked for one frame.
const editing = ref(props.mode !== 'view')
const submitting = ref(false)
const notice = ref(null)

// A summary line reads a person's name and face, never their login. Falls back to the id when the store has no row.
const { getUser } = usersStore()
const assignee = computed(() => {
  if (!doc.assigned_to) return null
  const u = getUser(doc.assigned_to)
  return { label: u?.full_name || doc.assigned_to, image: u?.user_image || '' }
})

// The ONE pill the header wears: how the row stands against its clock while it is open, how it ENDED once it is not — `dueBadge` answers null for exactly the Done/Canceled rows the status names.
const stateBadge = computed(
  () =>
    dueBadge(doc) ||
    (doc.status ? { label: doc.status, theme: statusTheme(doc.status) } : null),
)

// Each row states its own clock. A promise reads by when it is DUE; a record by when it was LOGGED — which
// was absent entirely, so a rep reading a logged visit could not tell when it happened.
const rowClock = computed(() => {
  if (hasAppointment.value)
    return doc.due_date
      ? `${__('Due')} ${formatDate(doc.due_date, 'D MMM, h:mm a')}`
      : ''
  const at = loadedTask.value?.creation
  return at ? `${__('Logged')} ${formatDate(at, 'D MMM, h:mm a')}` : ''
})

const showLeadLink = computed(() => !name.value && !props.lead)
const leadName = computed(() => refDocname.value)

// Reading locks the form; everything else opens it. "Log Activity" is this form with defaultType passed in.
const locked = computed(() => !editing.value)

const isExisting = computed(() => Boolean(props.task || name.value))

// A row is born an APPOINTMENT (someone promised it) or a RECORD (someone logged what they did), and it
// never changes its mind. The server stamps which at insert and `task_detail` sends it back, so the client
// reads the fact rather than guessing — a rep clearing a due date must not turn a kept promise into a bare
// record. For a row that does not exist yet the door decides: Log Activity records, everything else plans.
// THE one question. The two halves below read it and nothing else does.
const hasAppointment = computed(() =>
  isExisting.value ? Boolean(loadedTask.value?.is_planned) : !props.defaultType,
)

// Decided once the row NAMES a type — read off the loaded row, never off `doc`, which changes as the rep picks and would otherwise mute the picker mid-choice.
const typeIsFixed = computed(() => Boolean(loadedTask.value?.task_type))

// The other half: the type's declared questions. A new PLAN has none — the answers belong to the moment the
// work is done, not the moment it is promised — so picking a type while planning must not summon them.
const hasRecord = computed(() =>
  isExisting.value
    ? Boolean(schemaFields.value.length || loadedTask.value?.location)
    : Boolean(props.defaultType),
)

// The one gate on "are we recording what happened": routes the save through compute_activity, makes the answers mandatory.
const capturesAnswers = computed(
  () =>
    hasRecord.value && !!doc.custom_task_type && schemaFields.value.length > 0,
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

// Set Value, mirrored for the eye: the server recomputes and discards ours, but a blank on screen would lie.
watch(visibility, (v) => {
  for (const [fieldname, value] of Object.entries(
    copiedValues(schemaFields.value, v),
  ))
    if (activity[fieldname] !== value) activity[fieldname] = value
})
const visibleSchemaFields = computed(() =>
  schemaFields.value.filter((f) => visibility.value.fields.has(f.fieldname)),
)

// Mandatory is a rule, not the static `reqd` flag, so the asterisk and the save gate give the server's answer.
const isRequired = (f) => requiredHere(f, visibility.value)

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

// The button names what the click will DO, so it reads the same flag the save path branches on.
const saveLabel = computed(() => {
  if (name.value) return __('Save')
  return capturesAnswers.value ? __('Log Activity') : __('Create')
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
      toast.error(
        (e && (e.messages?.[0] || e.message)) ||
          __('Could not load this task.'),
      )
      // Left open, the empty `doc` paints a create form titled "New Task" over a task that exists.
      loading.value = false
      show.value = false
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
    // Swallowed, this saved with no fix, the server refused it for a missing location, and the rep read a
    // generic "could not save" — never the one thing they could have acted on.
    toast.error(__("Couldn't check this visit's location — please try again."))
    return 'abort'
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

// The CRM Task's own columns the form EDITED. A log draws no assignee control, and the blank it never asked
// for lands in the same `doc.update` after the server named the rep (api.py:1026-1030), clobbering them.
function stdFields() {
  const std = {
    title: doc.title || selectedTypeLabel.value || '',
    description: doc.description || '',
    status: doc.status,
    priority: doc.priority,
    due_date: doc.due_date || null,
    start_date: doc.start_date || null,
  }
  if (hasAppointment.value) std.assigned_to = doc.assigned_to || null
  return std
}

async function save() {
  if (submitting.value) return

  // An appointment with no time is not an appointment — and the server reads the due date at insert to
  // decide which half this row is born as, so a plan saved without one would be stamped a record for good.
  if (hasAppointment.value && !isExisting.value && isEmpty(doc.due_date)) {
    toast.error(
      __('Give this task a due date — that is what makes it a reminder.'),
    )
    return
  }

  const isTyped = capturesAnswers.value
  if (isTyped) {
    const missing = visibleSchemaFields.value.filter(
      (f) => isRequired(f) && isEmpty(activity[f.fieldname]),
    )
    if (missing.length) {
      toast.error(
        __('Please fill: {0}', [missing.map((f) => f.label).join(', ')]),
      )
      return
    }
    if (!leadName.value) {
      toast.error(__('Link a lead to log an activity task.'))
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

      // ONE writer, create and update alike — the door the partner API punches through. Computing here and
      // asserting the answer back in a generic insert was two transactions: on a location-tracked grain the
      // first committed the anchor and an Accepted audit row that could name no task, and a failure in the
      // second left that visit pointing at nothing.
      savedName = await call('tatva_connect.activity.api.save_activity', {
        lead: leadName.value,
        task_type: doc.custom_task_type,
        values: JSON.stringify(values),
        task: savedName || undefined,
        task_fields: JSON.stringify(stdFields()),
      })
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
    toast.error(
      (e && (e.messages?.[0] || e.message)) ||
        __('Could not save — please try again.'),
    )
  } finally {
    submitting.value = false
  }
}

function cancel() {
  // Cancel restores the loaded values; without it an abandoned edit stays on screen looking saved.
  if (props.mode === 'view') {
    applyLoaded()
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
