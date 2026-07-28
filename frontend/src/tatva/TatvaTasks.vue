<!-- TatvaTasks — the native, config-driven Tasks board for a CRM Lead (replaces stock TaskArea for leads). -->
<!-- Renders from ONE payload (tatva_connect.activity.api.lead_task_board) through the shared ActivityCard, in a soft-bucketed timeline (Overdue/Due Today/Upcoming/History). Per-type detail lives in the modal. -->
<!-- We hold task.name → exact identity: card click opens VIEW; the tile status control routes Done on an activity type to COMPLETE (fields→GPS→gate→save_activity), else flips natively; "Log Activity" opens the grain-scoped picker→CREATE. Owns window.__tcLogActivity; server validate backstops every path. -->
<template>
  <div class="flex flex-1 flex-col">
    <!-- the native Data tab's loading state (Activities/DataFields.vue), verbatim — the same one DetailPanel uses, so a lead's tabs do not each load differently -->
    <div
      v-if="board.loading && !board.data"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-xl font-medium text-ink-gray-6"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span>{{ __('Loading...') }}</span>
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

    <!-- One timeline, soft buckets (Overdue / Due Today / Upcoming / History) over the shared ActivityCard.
         The bucket label is the only separation; the card never changes (U9). Status lives in the tile. -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="group in grouped"
        :key="group.key"
        class="flex flex-col gap-2"
      >
        <div
          class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5"
        >
          <span :class="dueTextClass(group.color)">{{ group.label }}</span>
          <span class="h-px flex-1 bg-outline-gray-modals" />
        </div>
        <ActivityCard
          v-for="task in group.rows"
          :key="task.name"
          v-bind="taskCard(task)"
          @open="openView(task)"
        >
          <template #tile>
            <Dropdown :options="taskStatusOptions(onStatus, task)" @click.stop>
              <button
                type="button"
                :title="__('Change Status')"
                class="flex size-9 items-center justify-center rounded-lg bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3 sm:size-10"
                @click.stop.prevent
              >
                <TaskStatusIcon :status="task.status" />
              </button>
            </Dropdown>
          </template>
        </ActivityCard>
      </div>
    </div>

    <!-- The ONE native task modal: view / edit / complete (Done) / create. For "Log Activity" it opens
         in create mode with the chosen type preselected (createType); New Task opens it free-flow. -->
    <!-- v-if + v-model, like every other mount site: a fresh modal per open, so the previous task's state can never paint first. -->
    <TaskModal
      v-if="modalOpen"
      v-model="modalOpen"
      :task="selected"
      :lead="lead"
      :mode="modalMode"
      :default-type="createType"
      @saved="board.reload()"
    />

    <!-- "Log Activity" — the DIRECT path: a grain-scoped, searchable type LIST. Pick a type → the type's
         schema modal (TaskModal preselected) to log + submit. Lead detail only. -->
    <ResponsiveDialog
      v-model="pickerOpen"
      :options="{ size: 'sm', title: __('Log Activity') }"
    >
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
          <div
            v-if="!pickedTypes.length"
            class="px-2 py-4 text-center text-sm text-ink-gray-5"
          >
            {{
              types.loading
                ? __('Loading...')
                : __('No activity types are configured for this lead.')
            }}
          </div>
        </div>
      </template>
    </ResponsiveDialog>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  createResource,
  call,
  toast,
  Dropdown,
  FormControl,
  LoadingIndicator,
} from 'frappe-ui'
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import TaskModal from '@/tatva/TaskModal.vue'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import ActivityCard from '@/tatva/ActivityCard.vue'
import { actorFor } from '@/tatva/activityCard.js'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import { activityToolbar } from '@/tatva/activityToolbar.js'
import { passesFilter } from '@/tatva/activityMatch.js'
import { statusTheme } from '@/tatva/taskStatus.js'
import { DUE_BUCKETS, dueBadge, dueBucket, dueTextClass } from '@/tatva/taskDue.js'
import { taskStatusOptions } from '@/utils'

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
    const types = [
      ...new Set(list.map((t) => t.task_type_label).filter(Boolean)),
    ]
    activityToolbar.fields = [
      {
        fieldname: 'status',
        fieldtype: 'Select',
        label: __('Status'),
        options: STATUS_OPTIONS,
      },
      {
        fieldname: 'task_type_label',
        fieldtype: 'Select',
        label: __('Task Type'),
        options: types.join('\n'),
      },
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

// A task → the four-slot card shape. Status lives in the tile control, so the badge shows only a terminal
// outcome; an open task's flavor line is `due · priority`, a done task's is its completion narrative.
// Location/attachment presence become icon-only CORNER indicators.
function taskCard(task) {
  const done = task.status === 'Done' || task.status === 'Canceled'
  const corner = []
  if (task.location)
    corner.push({ icon: 'map-pin', tooltip: __('Location captured') })
  if (task.attachments)
    corner.push({
      icon: 'paperclip',
      tooltip: __('{0} attachment(s)', [task.attachments]),
    })
  const completion = task.completed_on
    ? `${__('Completed')} ${task.completed_on}${task.completed_by ? ' · ' + task.completed_by : ''}`
    : ''
  return {
    title: task.title,
    // Closed → its status. Open → its due state, which used to be NOTHING: an overdue task looked
    // identical to one due next month, and the only overdue signal was the heading it sat under.
    badge: done
      ? { label: task.status, theme: statusTheme(task.status) }
      : dueBadge(task),
    flavor: done
      ? completion
      : [task.due, task.priority].filter(Boolean).join(' · '),
    corner,
    actor: actorFor(task.automation, {
      label: task.rep_name,
      image: task.rep_image,
    }),
    at: task.creation,
    dimmed: done,
  }
}

// One list, soft buckets from the shared taskDue rule (same rule the list/Kanban read). The bucket LABEL
// carries the callout colour (Overdue red, Due/Upcoming amber); the card itself is untouched.
const grouped = computed(() => {
  const by = { overdue: [], today: [], upcoming: [], history: [] }
  for (const t of cards.value) by[dueBucket(t)].push(t)
  return DUE_BUCKETS.filter((b) => by[b.key].length).map((b) => ({
    ...b,
    rows: by[b.key],
  }))
})

// Map config is not this component's business: TaskModal resolves the ONE shared config itself
// (composables/mapConfig.js), lazily, when a map is actually about to be drawn.

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
    status === 'Done' &&
    cfg &&
    (cfg.fields?.length || cfg.captures_location || cfg.is_logged_complete)
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
    toast.error(
      (e && (e.messages?.[0] || e.message)) || __('Could not update the task.'),
    )
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
  return all.filter((t) =>
    String(t.label || t.name)
      .toLowerCase()
      .includes(q),
  )
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
