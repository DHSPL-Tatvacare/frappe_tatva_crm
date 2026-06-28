<!--
  TatvaTasks — the native, config-driven Tasks/Activities board for a CRM Lead.

  Replaces the stock TaskArea for leads (Activities.vue, gated to doctype === 'CRM Lead'). Renders
  entirely from ONE server payload (tatva_connect.activity.api.lead_task_board): each task as a
  UNIFORM card — status control + title + unique ID, common info, a type Badge, and a reliable OSM map
  thumbnail (or a neutral slot). Per-type detail lives in the modal, so every card is the same size.

  Lifecycle (Phase 2) — we hold task.name, so identity is EXACT (no DOM/title guessing):
    • Card body click → open OUR modal in VIEW mode (pre-filled saved values, never the stock modal).
    • Status control → Done on an activity type opens the modal in COMPLETE mode (collect fields → GPS →
      gate → save_activity(task=name)); any other status flips natively. A plain task's Done flips too.
    • "Log Activity" (ActivityHeader split button) → openCreate(): grain-scoped picker → modal in CREATE
      mode → save_activity(task=undefined). This board OWNS window.__tcLogActivity now (the form-script
      punch flow is retired); the server validate backstops still fail-close every path.

  Lives in frontend/src/tatva/ (additive — never conflicts on upstream cherry-pick).
-->
<template>
  <div class="flex flex-1 flex-col">
    <div
      v-if="board.loading && !board.data"
      class="flex flex-1 items-center justify-center text-base text-ink-gray-5"
    >
      {{ __('Loading…') }}
    </div>

    <div v-else-if="!tasks.length" class="relative flex-1">
      <EmptyState
        name="tasks"
        :title="__('No tasks yet')"
        :description="__('Create a task to get started.')"
        :icon="TaskIcon"
      />
    </div>

    <div
      v-else-if="!cards.length"
      class="flex flex-1 items-center justify-center text-base text-ink-gray-5"
    >
      {{ __('No tasks match the filter.') }}
    </div>

    <!-- Unified activity-card shape (same as Calls/Comments): timeline rail + "who logged a task ·
         when" header + a bordered content block carrying the task's status & details. -->
    <div v-else class="flex flex-col">
      <div
        v-for="(task, i) in cards"
        :key="task.name"
        class="activity grid grid-cols-[30px_minmax(auto,_1fr)] gap-2 sm:gap-4"
      >
        <!-- timeline rail: icon-in-circle + connecting line -->
        <div
          class="z-0 relative flex justify-center before:absolute before:left-[50%] before:-z-[1] before:top-0 before:border-l before:border-outline-gray-modals"
          :class="i != cards.length - 1 ? 'before:h-full' : 'before:h-4'"
        >
          <div
            class="flex h-8 w-7 items-center justify-center bg-surface-white text-ink-gray-8"
          >
            <TaskIcon />
          </div>
        </div>

        <div class="mb-4 min-w-0">
          <!-- header: who logged the task + when -->
          <div class="mb-1 flex items-center justify-stretch gap-2 py-1 text-base">
            <div class="inline-flex items-center flex-wrap gap-1 text-ink-gray-5">
              <Avatar :image="task.rep_image" :label="task.rep_name" size="md" />
              <span class="font-medium text-ink-gray-8 ml-1">{{ task.rep_name }}</span>
              <span>{{ __('logged a task') }}</span>
            </div>
            <div class="ml-auto whitespace-nowrap">
              <Tooltip :text="formatDate(task.creation)">
                <div class="text-sm text-ink-gray-5">
                  {{ __(timeAgo(task.creation)) }}
                </div>
              </Tooltip>
            </div>
          </div>

          <!-- content block (mirrors the Call card) -->
          <div
            class="flex flex-col gap-2 border cursor-pointer border-outline-gray-modals rounded-md bg-surface-cards px-3 py-2.5 text-ink-gray-9"
            @click="openView(task)"
          >
            <!-- title row: status control · title · #id -->
            <div class="flex min-w-0 items-center gap-2">
              <Dropdown :options="taskStatusOptions(onStatus, task)">
                <Button
                  :tooltip="__('Change Status')"
                  variant="ghost"
                  class="shrink-0 hover:bg-surface-gray-3"
                  @click.stop.prevent
                >
                  <TaskStatusIcon :status="task.status" />
                </Button>
              </Dropdown>
              <span class="truncate font-medium text-ink-gray-9">{{ task.title }}</span>
              <span class="shrink-0 text-xs text-ink-gray-4">#{{ task.name }}</span>
            </div>

            <!-- chips: due · priority · type (if it adds info) · status (themed) · located -->
            <div class="flex flex-wrap items-center gap-2">
              <Badge v-if="task.due" theme="gray" :label="task.due">
                <template #prefix><FeatherIcon name="calendar" class="size-3" /></template>
              </Badge>
              <Badge v-if="task.priority" theme="gray" :label="task.priority">
                <template #prefix><FeatherIcon name="flag" class="size-3" /></template>
              </Badge>
              <Badge
                v-if="task.task_type_label && task.task_type_label !== task.title"
                theme="gray"
                :label="task.task_type_label"
              />
              <Badge :theme="statusTheme(task.status)" :label="task.status" />
              <Badge v-if="task.location" theme="green" :label="__('Located')">
                <template #prefix><FeatherIcon name="map-pin" class="size-3" /></template>
              </Badge>
              <Badge v-if="task.attachments" theme="gray" :label="String(task.attachments)">
                <template #prefix><FeatherIcon name="paperclip" class="size-3" /></template>
              </Badge>
            </div>

            <!-- completion narrative (Done only) -->
            <div
              v-if="task.completed_on"
              class="flex items-center gap-1 text-xs text-ink-gray-5"
            >
              <FeatherIcon name="check-circle" class="size-3 shrink-0 text-ink-green-3" />
              <span class="truncate">
                {{ __('Completed') }} {{ task.completed_on }}<template v-if="task.completed_by"> · {{ task.completed_by }}</template>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- The ONE native task modal: view / edit / complete (Done) / create. For "Log Activity" it opens
         in create mode with the chosen type preselected (createType); New Task opens it free-flow. -->
    <TaskModal
      v-model="modalOpen"
      :task="selected"
      :lead="lead"
      :mode="modalMode"
      :default-type="createType"
      :map-config="mapCfg"
      @saved="board.reload()"
    />

    <!-- "Log Activity" — the DIRECT path: a grain-scoped, searchable type LIST. Pick a type → the type's
         schema modal (TaskModal preselected) to log + submit. Lead detail only. -->
    <ResponsiveDialog v-model="pickerOpen" :options="{ size: 'sm', title: __('Log Activity') }">
      <template #body-content>
        <FormControl
          v-model="pickerQuery"
          type="text"
          :placeholder="__('Search activity types…')"
          class="mb-3"
        />
        <div class="flex flex-col gap-0.5 overflow-auto sm:max-h-[50vh]">
          <button
            v-for="t in pickedTypes"
            :key="t.name"
            class="rounded-md px-2.5 py-2 text-left text-sm text-ink-gray-8 hover:bg-surface-gray-2"
            @click="chooseType(t)"
          >
            {{ t.label || t.name }}
          </button>
          <div v-if="!pickedTypes.length" class="px-2 py-4 text-center text-sm text-ink-gray-5">
            {{ types.loading ? __('Loading…') : __('No activity types are configured for this lead.') }}
          </div>
        </div>
      </template>
    </ResponsiveDialog>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { createResource, call, toast, Avatar, Badge, Button, Dropdown, FormControl, FeatherIcon, Tooltip } from 'frappe-ui'
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import TaskModal from '@/tatva/TaskModal.vue'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import { activityToolbar } from '@/tatva/activityToolbar.js'
import { passesFilter } from '@/tatva/activityMatch.js'
import { statusTheme } from '@/tatva/taskStatus.js'
import { taskStatusOptions, formatDate, timeAgo } from '@/utils'

const props = defineProps({
  lead: { type: String, default: '' },
})

const board = createResource({
  url: 'tatva_connect.activity.api.lead_task_board',
  makeParams: () => ({ lead: props.lead }),
})

// ONE fetch, lead-resolve-safe: immediate watch loads as soon as `lead` is present (whether at mount
// or when the lead doc resolves a tick later). No `auto:true` — that fetched a second time once the prop
// settled. Switching leads remounts this component (lead page is keyed on $route.fullPath), so no extra
// reload needed here. (See Smart Views 1×-API lesson.)
watch(
  () => props.lead,
  () => props.lead && board.reload(),
  { immediate: true },
)

const tasks = computed(() => board.data?.tasks || [])
const typeConfig = (taskType) => board.data?.types?.[taskType] || null

// Publish the Filter fields (status + types present) so the native Filter.vue in the header drives the board.
const STATUS_OPTIONS = 'Backlog\nTodo\nDone\nCanceled'
watch(
  tasks,
  (list) => {
    const types = [...new Set(list.map((t) => t.task_type_label).filter(Boolean))]
    activityToolbar.fields = [
      { fieldname: 'status', fieldtype: 'Select', label: __('Status'), options: STATUS_OPTIONS },
      { fieldname: 'task_type_label', fieldtype: 'Select', label: __('Task Type'), options: types.join('\n') },
    ]
    // Show the header search + Filter only when this lead actually has tasks (unfiltered).
    activityToolbar.hasData = list.length > 0
  },
  { immediate: true },
)

// Filter (native predicate) + free-text search from the shared header toolbar, applied client-side.
const cards = computed(() => {
  const q = activityToolbar.search.trim().toLowerCase()
  return tasks.value.filter(
    (t) =>
      passesFilter(t, activityToolbar.predicate) &&
      (!q ||
        `${t.title || ''} ${t.task_type_label || ''} ${t.status || ''} ${t.rep_name || ''}`
          .toLowerCase()
          .includes(q)),
  )
})


// Operator-switchable map providers (CRM Maps Settings → Map Display). One fetch, shared by every
// card thumbnail and the modal; resolved server-side for availability. Defaults preserve today's mix.
const mapCfgRes = createResource({ url: 'tatva_connect.location.api.map_config', auto: true })
const mapCfg = computed(
  () =>
    mapCfgRes.data || {
      thumbnail: 'osm',
      dialog: 'google',
      zoom: 16,
      tile_url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    },
)

const selected = ref(null)
const modalMode = ref('view')
const modalOpen = ref(false)
const createType = ref('') // preselected type for the "Log Activity" direct path (else free-flow create)

// Card click → view the exact task (TaskModal loads it fully by name). Identity is exact (task.name).
function openView(task) {
  selected.value = { name: task.name }
  createType.value = ''
  modalMode.value = 'view'
  modalOpen.value = true
}

function openComplete(task) {
  selected.value = { name: task.name }
  createType.value = ''
  modalMode.value = 'complete'
  modalOpen.value = true
}

// Status control: Done on an activity type (has fields, captures location, or logs-complete) routes
// through the complete flow with the exact task.name; everything else is a native status flip.
function onStatus(status, task) {
  if (status === task.status) return
  const cfg = typeConfig(task.task_type)
  const needsForm =
    status === 'Done' && cfg && (cfg.fields?.length || cfg.captures_location || cfg.is_logged_complete)
  if (needsForm) openComplete(task)
  else flipStatus(task, status)
}

async function flipStatus(task, status) {
  try {
    await call('frappe.client.set_value', {
      doctype: 'CRM Task',
      name: task.name,
      fieldname: 'status',
      value: status,
    })
    board.reload()
  } catch (e) {
    toast.error((e && (e.messages?.[0] || e.message)) || __('Could not update the task.'))
  }
}

// "Log Activity" (header split / window bridge) → the DIRECT path: open the grain-scoped type LIST.
// Picking a type opens the TaskModal preselected to it (its schema). New Task is the free-flow create.
const pickerOpen = ref(false)
const pickerQuery = ref('')
const types = createResource({
  url: 'tatva_connect.activity.api.list_types_for_lead',
  makeParams: () => ({ lead: props.lead }),
})
const pickedTypes = computed(() => {
  const q = pickerQuery.value.trim().toLowerCase()
  const all = types.data || []
  if (!q) return all
  return all.filter((t) => String(t.label || t.name).toLowerCase().includes(q))
})

function openCreate() {
  pickerQuery.value = ''
  pickerOpen.value = true
  types.reload()
}

function chooseType(t) {
  pickerOpen.value = false
  selected.value = null
  createType.value = t.name // composite PK — TaskModal preselects it and renders ONLY its schema
  modalMode.value = 'log' // schema-only: just the type's form (+ dependent setup), no standard fields
  modalOpen.value = true
}

// Bridges: the header "Log Activity" item calls openCreate; ad-hoc punches refresh via __tcReloadTasks.
onMounted(() => {
  window.__tcLogActivity = () => openCreate()
  window.__tcReloadTasks = () => board.reload()
})
onBeforeUnmount(() => {
  if (window.__tcLogActivity) delete window.__tcLogActivity
  if (window.__tcReloadTasks) delete window.__tcReloadTasks
  // Toolbar (search/filter/fields) is reset by Activities.vue's per-tab watch — single owner.
})

defineExpose({ reload: () => board.reload(), openCreate })
</script>
