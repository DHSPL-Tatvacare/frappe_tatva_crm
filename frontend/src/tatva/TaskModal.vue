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
  <ResponsiveDialog v-model="show" :options="{ size: 'lg' }">
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
      <!-- The record fetch owns the body until it lands — stock's Data tab does exactly this
           (Activities/DataFields.vue: v-if="document.get.loading" -> LoadingIndicator -> v-else content).
           Without it the dialog paints a fully-formed EMPTY shell (title "New Task", no fields) and then
           fills in, which is the blink. One transition, not two. -->
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center gap-3 py-12 text-xl font-medium text-ink-gray-6"
      >
        <LoadingIndicator class="h-6 w-6" />
        <span>{{ __('Loading...') }}</span>
      </div>
      <div
        v-else
        class="flex flex-col gap-5 overflow-y-auto pr-0.5 sm:max-h-[60vh]"
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

        <!-- VIEW: read-only -->
        <template v-if="!editing">
          <div class="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
            <div v-if="doc.priority" class="min-w-0">
              <div class="mb-0.5 text-xs text-ink-gray-5">
                {{ __('Priority') }}
              </div>
              <div class="text-sm text-ink-gray-8">{{ doc.priority }}</div>
            </div>
            <div v-if="doc.due_date" class="min-w-0">
              <div class="mb-0.5 text-xs text-ink-gray-5">{{ __('Due') }}</div>
              <div class="text-sm text-ink-gray-8">
                {{ formatDate(doc.due_date) }}
              </div>
            </div>
            <div v-if="doc.assigned_to" class="min-w-0">
              <div class="mb-0.5 text-xs text-ink-gray-5">
                {{ __('Assignee') }}
              </div>
              <div class="text-sm text-ink-gray-8">
                {{ getUser(doc.assigned_to)?.full_name || doc.assigned_to }}
              </div>
            </div>
          </div>
          <div v-if="doc.description" class="min-w-0">
            <div class="mb-0.5 text-xs text-ink-gray-5">
              {{ __('Description') }}
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div
              class="prose-sm max-w-none text-ink-gray-8"
              v-html="sanitizeHTML(doc.description)"
            />
          </div>

          <!-- saved activity values -->
          <div
            v-if="savedRows.length"
            class="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2"
          >
            <div v-for="r in savedRows" :key="r.label" class="min-w-0">
              <div class="mb-0.5 text-xs text-ink-gray-5">
                {{ __(r.label) }}
              </div>
              <a
                v-if="isAttach(r.fieldtype)"
                :href="r.value"
                target="_blank"
                rel="noopener noreferrer"
                class="break-all text-sm text-ink-gray-8 underline"
                >{{ fileName(r.value) }}</a
              >
              <div v-else class="break-words text-sm text-ink-gray-8">
                {{ r.value }}
              </div>
            </div>
          </div>
          <div v-if="savedNotes">
            <div class="mb-0.5 text-xs text-ink-gray-5">{{ __('Notes') }}</div>
            <div
              class="whitespace-pre-wrap break-words text-sm text-ink-gray-8"
            >
              {{ savedNotes }}
            </div>
          </div>
          <div v-if="loadedTask?.location">
            <div class="mb-1.5 flex items-start gap-1 text-xs text-ink-gray-5">
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
              <div class="mb-1.5 text-xs text-ink-gray-5">
                {{ __('Description') }}
              </div>
              <TextEditorControl
                :value="doc.description"
                variant="outline"
                size="sm"
                :placeholder="__('Add a description…')"
                :upload-function="stageInline"
                @change="doc.description = $event"
              />
            </div>

            <!-- Lead link only when no lead/deal context was passed. -->
            <div v-if="showLeadLink">
              <div class="mb-1.5 text-xs text-ink-gray-5">
                {{ __('Link a lead') }}
              </div>
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
                <div class="mb-1.5 text-xs text-ink-gray-5">
                  {{ __('Status') }}
                </div>
                <FormControl
                  v-model="doc.status"
                  type="select"
                  :options="STATUS_OPTIONS"
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
                />
              </div>
              <div>
                <div class="mb-1.5 text-xs text-ink-gray-5">
                  {{ __('Due Date') }}
                </div>
                <DateTimePicker
                  :value="doc.due_date"
                  :format="datetimeFormat"
                  :placeholder="__('Select date & time')"
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
                  :placeholder="__('Select date')"
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
                  :placeholder="__('Assign to…')"
                  @change="(v) => (doc.assigned_to = v)"
                />
              </div>
              <div>
                <div class="mb-1.5 text-xs text-ink-gray-5">
                  {{ __('Task Type') }}
                </div>
                <!-- Grain-scoped to the lead (invariant 9) — NOT a generic Link, which would offer
                   out-of-scope types that the server rejects. -->
                <FormControl
                  v-model="doc.custom_task_type"
                  type="select"
                  :options="typeOptions"
                  :disabled="!leadName"
                />
              </div>
            </div>
          </template>

          <!-- The chosen type's fields, in the tabs, sections and columns the type DECLARES — the tree the
               server walked in activity/api.py:_layout, which is Frappe's own form/layout.js model.
               EVERY declared field is mounted and hidden with v-show, never filtered out of the list: a
               field's column is fixed by the declaration, so revealing a neighbour moves it DOWN its own
               column and never sideways, and its control keeps its DOM node, its focus and its cursor.
               A type declaring no markers renders one tab, one section, one column — the flat form. -->
          <template v-if="schemaFields.length">
            <div v-if="!schemaOnly" class="h-px bg-outline-gray-modals" />
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
                <!-- Columns share the row evenly and a hidden one gives its space back, which is what
                     Frappe's Column.resize_all_columns does in JS; flex-1 basis-0 does it in CSS. -->
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
                    <div
                      v-for="f in column.fields"
                      v-show="visibility.fields.has(f.fieldname)"
                      :key="f.fieldname"
                      :data-tc-field="f.fieldname"
                      class="min-w-0"
                    >
                      <label class="mb-1.5 block text-sm text-ink-gray-5">
                        {{ __(f.label)
                        }}<span v-if="f.reqd" class="text-ink-red-3">*</span>
                      </label>
                      <FormControl
                        v-if="f.fieldtype === 'Select'"
                        v-model="activity[f.fieldname]"
                        type="select"
                        :options="optionList(f)"
                        :disabled="Boolean(f.read_only)"
                      />
                      <DateTimePicker
                        v-else-if="f.fieldtype === 'Datetime'"
                        :value="activity[f.fieldname]"
                        :format="datetimeFormat"
                        :placeholder="__('Select date & time')"
                        :disabled="Boolean(f.read_only)"
                        @change="(v) => (activity[f.fieldname] = v)"
                      />
                      <DatePicker
                        v-else-if="f.fieldtype === 'Date'"
                        :value="activity[f.fieldname]"
                        :format="dateFormat"
                        :placeholder="__('Select date')"
                        :disabled="Boolean(f.read_only)"
                        @change="(v) => (activity[f.fieldname] = v)"
                      />
                      <Link
                        v-else-if="
                          f.fieldtype === 'Link' || f.fieldtype === 'User'
                        "
                        :value="activity[f.fieldname]"
                        :doctype="
                          f.fieldtype === 'User' ? 'User' : f.options || 'User'
                        "
                        :placeholder="__('Select {0}', [f.label])"
                        :disabled="Boolean(f.read_only)"
                        @change="(v) => (activity[f.fieldname] = v)"
                      />
                      <div
                        v-else-if="f.fieldtype === 'Check'"
                        class="flex h-8 items-center"
                      >
                        <FormControl
                          v-model="activity[f.fieldname]"
                          type="checkbox"
                          :disabled="Boolean(f.read_only)"
                        />
                      </div>
                      <FormControl
                        v-else-if="
                          ['Small Text', 'Text', 'Long Text'].includes(
                            f.fieldtype,
                          )
                        "
                        v-model="activity[f.fieldname]"
                        type="textarea"
                        :disabled="Boolean(f.read_only)"
                      />
                      <AttachControl
                        v-else-if="isAttach(f.fieldtype)"
                        :value="activity[f.fieldname]"
                        doctype="CRM Lead"
                        :docname="leadName"
                        :imageOnly="f.fieldtype === 'Attach Image'"
                        :disabled="Boolean(f.read_only)"
                        @change="(url) => (activity[f.fieldname] = url)"
                      />
                      <FormControl
                        v-else
                        v-model="activity[f.fieldname]"
                        type="text"
                        :disabled="Boolean(f.read_only)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-sm text-ink-gray-5">{{
                __('Notes')
              }}</label>
              <FormControl
                v-model="activity.notes"
                type="textarea"
                :placeholder="__('Optional notes')"
              />
            </div>
            <div
              v-if="config?.captures_location"
              class="flex items-start gap-1.5 text-xs text-ink-gray-5"
            >
              <span>📍</span>
              <span>{{
                __(
                  'Your location will be captured and checked against the doctor when you save this visit.',
                )
              }}</span>
            </div>
          </template>

          <ErrorMessage v-if="error" :message="error" />
        </template>
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

  <!-- Out-of-range block + capture receipt (server static_map proxy, key-safe) -->
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
            'Reach within {0} m of the doctor to log this visit — you are {1} m away.',
            [notice.allowed_m, notice.distance_m],
          )
        }}
        <div v-if="notice.address" class="mt-2 text-xs text-ink-gray-5">
          📍 {{ notice.address }}
        </div>
      </div>
      <div v-else class="text-sm text-ink-gray-7">
        {{ __('Logged at your current location.') }}
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
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
import AttachControl from '@/components/Controls/AttachControl.vue'
import TatvaMiniMap from '@/tatva/TatvaMiniMap.vue'
import { useMapConfig } from '@/composables/mapConfig'
import { statusTheme } from '@/tatva/taskStatus.js'
import { displayFileName } from '@/tatva/files'
import { useStagedAttachments } from '@/tatva/useStagedAttachments'
import {
  evaluateDependsOnValue,
  getFormat,
  formatDate,
  sanitizeHTML,
} from '@/utils'
import { usersStore } from '@/stores/users'

const props = defineProps({
  task: { type: Object, default: null }, // existing task ({name, title, status, ..., values, location}) or null
  lead: { type: String, default: '' }, // lead/deal context; empty => standalone (show picker)
  referenceDoctype: { type: String, default: 'CRM Lead' }, // context doctype (CRM Lead | CRM Deal)
  defaultType: { type: String, default: '' }, // preselect a task type (composite PK) on create — the "Log Activity" direct path
  mode: { type: String, default: 'view' }, // 'view' | 'edit' | 'create' | 'complete'
})

// The ONE map config, fetched once and shared (composables/mapConfig.js) — not a prop every host page
// has to fetch and hand down, and not a default this component re-declares.
const show = defineModel({ type: Boolean, default: false })
// v-if at every mount site means this component only exists while open — setup IS open, so this is not an eager fetch.
useMapConfig()
const emit = defineEmits(['saved'])

const { getUser } = usersStore()

// Inline editor media (Image/Video/Embed) stages locally and uploads OWNED by the task on Save.
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
const leadValues = ref({}) // the lead's current values for this type's source=Lead fields (D11/D31)
// True only while an existing task's record fetch is in flight. Create has nothing to fetch, so it is
// false from the first frame and the form paints complete — which is why "New Task" was already smooth.
const loading = ref(!!props.task?.name)
const editing = ref(false)
const submitting = ref(false)
const error = ref(null)
const notice = ref(null)

// Lead picker only when creating a brand-new task with no context (e.g. the task listing page).
const showLeadLink = computed(() => !name.value && !props.lead)
const leadName = computed(() => refDocname.value)
// "Log Activity" + "Complete" are SCHEMA-ONLY: just the activity type's form (+ dependent setup,
// notes, location) — no standard task fields. New Task / edit show the full form.
const schemaOnly = computed(
  () => props.mode === 'log' || props.mode === 'complete',
)

// Grain-scoped task types for THIS lead (invariant 9 — the server filters by the lead's vertical/group/
// program; a generic Link would offer types compute_activity then rejects as out-of-scope).
const types = createResource({
  url: 'tatva_connect.activity.api.list_types_for_lead',
  makeParams: () => ({ lead: leadName.value }),
  // Cache ONLY when the lead is fixed for this instance's life. getCacheKey stringifies the key once at setup, so the standalone picker (lead empty until the user picks) would store one lead's types under the empty key and serve them to the next open.
  ...(props.lead ? { cache: ['tatva-task-types', props.lead] } : {}),
})
const typeOptions = computed(() => [
  { label: __('Select a task type…'), value: '' },
  ...(types.data || []).map((t) => ({
    label: t.label || t.name,
    value: t.name,
  })),
])
// The chosen type's clean label (type_name) — never the composite PK. Title falls back to this.
const selectedTypeLabel = computed(
  () =>
    (types.data || []).find((t) => t.name === doc.custom_task_type)?.label ||
    loadedTask.value?.task_type_label ||
    '',
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
    if (!v) {
      schemaFields.value = []
      config.value = null
      return
    }
    // Not cleared before loading: on a cached type the swap is atomic, so the field list never empties and re-grows.
    await loadSchema(v)
  },
)

// The layout the SERVER declared (type_config.tabs): tabs -> sections -> columns, walked once in
// activity/api.py:_layout. A column names its fields and `schemaFields` holds the one descriptor each, so
// the declaration crosses the wire once; they are joined back up here. This runs when a TYPE is loaded, not
// when an answer changes — the tree is structure and structure does not move while the rep types.
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

// One predicate for "is this shown", asked of a section's condition and of a field's — the same
// evaluateDependsOnValue the server mirrors in activity/api.py:_field_visible. There is no third.
function shown(condition, values) {
  return !condition || evaluateDependsOnValue(condition, values)
}

// The bag a condition is evaluated against: every DECLARED field present, blank until answered. The server
// seeds the same blanks (activity/api.py:_evaluable), because a rule compiled from "is not set" reads
// `doc.x == ""` and an untouched field is `undefined` here and `None` there — neither of which equals "".
function withBlanks(values) {
  const bag = {}
  for (const f of schemaFields.value) bag[f.fieldname] = ''
  for (const [k, v] of Object.entries(values || {}))
    bag[k] = v === null || v === undefined ? '' : v
  return bag
}
const liveValues = computed(() => withBlanks(activity))

// Is this field on screen: its own condition passes AND every container holding it is open. Line for line
// the server's activity/api.py:_shown_here, reading the same `container_depends_on` the server stamped —
// which is why a container ships no condition of its own and the two can never drift apart.
function fieldShown(f, values) {
  return (
    f.container_depends_on.every((c) => shown(c, values)) &&
    shown(f.depends_on, values)
  )
}

// What is on screen at every level for a given set of answers. A container is open exactly when it still
// holds a field that is shown — Frappe's own reduction in refresh_sections, not a second condition test.
// Everything the template asks reads this one result, so a keystroke evaluates each condition once.
function walkVisible(values) {
  const fields = new Set()
  const columns = new Set()
  const sections = new Set()
  const tabs = new Set()
  for (const tab of layout.value)
    for (const section of tab.sections)
      for (const column of section.columns)
        for (const f of column.fields)
          if (fieldShown(f, values)) {
            fields.add(f.fieldname)
            columns.add(column.key)
            sections.add(section.key)
            tabs.add(tab.key)
          }
  return { fields, columns, sections, tabs }
}

// D22/D29, the client half of activity/api.py:_shown_fieldnames — and it must settle from the SAME starting
// point, because a fixpoint reached from a different start is a different fixpoint. So, like the server:
// begin with every declared field counted as shown, read the hidden ones back as blank, and repeat until
// the set stops moving. That INERT step is what makes hiding a driver collapse the whole branch under it in
// one go, instead of rules having to be written in some order. Without it the rep can fill a field the save
// then refuses as "not shown on this form".
function settleVisible(values) {
  let shownNames = new Set(schemaFields.value.map((f) => f.fieldname))
  let settled
  for (let pass = 0; pass <= schemaFields.value.length; pass++) {
    const inert = { ...values }
    for (const f of schemaFields.value)
      if (!shownNames.has(f.fieldname)) inert[f.fieldname] = ''
    settled = walkVisible(inert)
    if (
      settled.fields.size === shownNames.size &&
      [...settled.fields].every((n) => shownNames.has(n))
    )
      break
    shownNames = settled.fields
  }
  return settled
}

const visibility = computed(() => settleVisible(liveValues.value))
// Every shown field ACROSS tabs: a tab is presentation, so switching one may never drop an answer.
const visibleSchemaFields = computed(() =>
  schemaFields.value.filter((f) => visibility.value.fields.has(f.fieldname)),
)

const activeTab = ref('')
// A tab whose every field is hidden offers nothing to click; with one tab left the strip disappears, the
// same reduction Frappe's refresh_tabs makes.
const tabButtons = computed(() =>
  layout.value
    .filter((t) => visibility.value.tabs.has(t.key))
    .map((t) => ({ label: t.label || __('Details'), value: t.key })),
)
// Land on the first tab that has something on it, and follow it when the type — or an answer that empties
// the open tab — moves under us.
watch(
  tabButtons,
  (buttons) => {
    if (!buttons.some((b) => b.value === activeTab.value))
      activeTab.value = buttons[0]?.value ?? ''
  },
  { immediate: true },
)

// VIEW: saved activity values, depends_on-filtered, non-empty. A lead-sourced field was never copied onto
// the task (D11), so its value comes from the lead — the same read the form prefills from.
const savedValues = computed(() => ({
  ...leadValues.value,
  ...(loadedTask.value?.values || {}),
}))
const savedVisibility = computed(() =>
  settleVisible(withBlanks(savedValues.value)),
)
const savedRows = computed(() =>
  schemaFields.value
    .filter((f) => savedVisibility.value.fields.has(f.fieldname))
    .map((f) => ({
      label: f.label,
      value: savedValues.value[f.fieldname],
      fieldtype: f.fieldtype,
    }))
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

// v-if at the mount site gives a fresh instance per open, so mount IS open and every ref already holds
// its declared default — the manual reset this block used to do is what v-if now does for free.
// Initialising in onMounted mirrors stock ContactModal.
onMounted(async () => {
  editing.value = props.mode !== 'view'

  // Seed the type from the list row BEFORE fetching: the row already carries it, and its schema is
  // cached per type, so the field list is correct on the first frame instead of appearing two
  // round-trips later (task_detail -> type -> type_config). Stock modals take their record data from
  // the row the list already loaded; only doctype-level schema is ever fetched.
  const rowType = props.task?.custom_task_type || props.task?.task_type || ''
  if (rowType) doc.custom_task_type = rowType

  if (props.task?.name) {
    // Load the FULL task by name (the board/listing pass a partial card or just {name}). One server
    // call, permission-checked (CRM Task read), with the activity values + location already parsed.
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
    Object.assign(activity, { ...t.values })
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

  // Resolve the schema BEFORE revealing, so the body appears once, complete — rather than appearing and
  // then growing as the fields land. Cached per type, so this is free from the second task of a type on.
  if (doc.custom_task_type) await loadSchema(doc.custom_task_type)
  loading.value = false

  // scope the type list to this lead; the doc.custom_task_type watcher loads the schema.
  if (leadName.value) types.reload()
})

// type_config is keyed by TASK TYPE, not by task — the same shape every stock cache uses
// (['QuickEntry', doctype]): one fetch per type, shared by every task of that type. A raw call() here
// meant the field list was rebuilt from the network on every open, which is the grow-after-paint.
// Keyed by the TYPE and the LEAD, because the answer carries this lead's current values for the type's
// source=Lead fields (D31): keyed by the type alone, one lead's values would be served to the next.
function typeConfigResource(taskType, lead) {
  return createResource({
    url: 'tatva_connect.activity.api.type_config',
    params: { task_type: taskType, lead: lead || undefined },
    cache: ['tatva-type-config', taskType, lead || ''],
  })
}

async function loadSchema(taskType) {
  const r = typeConfigResource(taskType, leadName.value)
  // Cache hit → data is already here, so the schema is on the FIRST frame and nothing shifts.
  if (!r.data) {
    try {
      await r.fetch()
    } catch {
      schemaFields.value = []
      config.value = null
      return
    }
  }
  config.value = r.data || null
  schemaFields.value = r.data?.fields || []
  // Lead-sourced fields (CRM Task Type Field.source = Lead) live on the LEAD and are never copied onto the
  // task (D11), so the form opens with the lead's CURRENT values — carried by the SAME answer, not a second
  // call — and the save writes them back through the server's own gate (D31).
  leadValues.value = r.data?.lead_values || {}
  // Prefill, never overwrite: a value the rep has already typed for this field wins.
  for (const [k, v] of Object.entries(leadValues.value))
    if (isEmpty(activity[k])) activity[k] = v
}

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

// Location lifecycle (only fires when the type needs it). Returns fix | null (not needed) | 'abort'.
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
      __('You are {0} m away — too far to log this visit.', [pre.distance_m]),
    )
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
        notice.value = { kind: 'receipt', lat: fix.lat, lng: fix.lng }
    } else {
      // plain task
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

    // Inline editor media: now that the task exists, upload each OWNED by it and rewrite the description.
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
    show.value = false
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
