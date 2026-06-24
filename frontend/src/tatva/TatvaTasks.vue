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

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="task in cards"
        :key="task.name"
        class="tc-task-card flex cursor-pointer flex-col gap-2 rounded-lg border border-outline-gray-2 bg-surface-cards p-3 transition hover:bg-surface-gray-1"
        @click="openView(task)"
      >
        <!-- title row: status control · title · #id · assignee avatar -->
        <div class="flex items-center gap-2">
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
          <Tooltip v-if="task.rep_name" :text="task.rep_name" class="ml-auto shrink-0">
            <Avatar :label="task.rep_name" :image="task.rep_image" size="sm" />
          </Tooltip>
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
            v-if="task.task_type && task.task_type !== task.title"
            theme="gray"
            :label="task.task_type"
          />
          <Badge :theme="statusTheme(task.status)" :label="task.status" />
          <Badge v-if="task.location" theme="green" :label="__('Located')">
            <template #prefix><FeatherIcon name="map-pin" class="size-3" /></template>
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

    <TatvaTaskModal
      v-model="modalOpen"
      :task="selected"
      :config="selectedConfig"
      :lead="lead"
      :mode="modalMode"
      :map-config="mapCfg"
      @saved="board.reload()"
    />

    <!-- CREATE: grain-scoped, searchable activity-type picker (native) -->
    <Dialog v-model="pickerOpen" :options="{ size: 'sm', title: __('Log Activity') }">
      <template #body-content>
        <FormControl
          v-model="pickerQuery"
          type="text"
          :placeholder="__('Search activity types…')"
          class="mb-3"
        />
        <div class="flex max-h-[50vh] flex-col gap-0.5 overflow-auto">
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
    </Dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { createResource, call, toast, Avatar, Badge, Button, Dropdown, Dialog, FormControl, FeatherIcon, Tooltip } from 'frappe-ui'
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import TatvaTaskModal from '@/tatva/TatvaTaskModal.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import { taskFilter, resetTaskFilter } from '@/tatva/taskFilter.js'
import { taskStatusOptions } from '@/utils'

const props = defineProps({
  lead: { type: String, default: '' },
  modalRef: { type: Object, default: () => ({}) },
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

// Publish the Filter fields (status + the types present on this board) so the native Filter.vue in the
// header drives the board. Status options are the CRM Task lifecycle; types are those actually present.
const STATUS_OPTIONS = 'Backlog\nTodo\nDone\nCanceled'
watch(
  tasks,
  (list) => {
    const types = [...new Set(list.map((t) => t.task_type).filter(Boolean))]
    taskFilter.fields = [
      { fieldname: 'status', fieldtype: 'Select', label: __('Status'), options: STATUS_OPTIONS },
      { fieldname: 'task_type', fieldtype: 'Select', label: __('Task Type'), options: types.join('\n') },
    ]
  },
  { immediate: true },
)

// Apply the native Filter's predicate to the board client-side (AND of leaf conditions on the card fields).
function matchCondition(task, c) {
  const v = task[c.field]
  const s = (x) => (x == null ? '' : String(x)).toLowerCase()
  const arr = Array.isArray(c.value) ? c.value : [c.value]
  switch (c.operator) {
    case '=': return s(v) === s(c.value)
    case '!=': return s(v) !== s(c.value)
    case 'like': return s(v).includes(s(c.value))
    case 'not like': return !s(v).includes(s(c.value))
    case 'in': return arr.map(s).includes(s(v))
    case 'not in': return !arr.map(s).includes(s(v))
    case 'is set': return v != null && v !== ''
    case 'is not set': return v == null || v === ''
    default: return true
  }
}
const cards = computed(() => {
  const conds = taskFilter.predicate?.conditions || []
  return tasks.value.filter((t) => conds.every((c) => matchCondition(t, c)))
})

function statusTheme(status) {
  return { Done: 'green', Todo: 'gray', Backlog: 'orange', Canceled: 'red' }[status] || 'gray'
}

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
const selectedConfig = ref(null)
const modalMode = ref('view')
const modalOpen = ref(false)

function openView(task) {
  selected.value = task
  selectedConfig.value = typeConfig(task.task_type)
  modalMode.value = 'view'
  modalOpen.value = true
}

function openComplete(task, cfg) {
  selected.value = task
  selectedConfig.value = cfg
  modalMode.value = 'complete'
  modalOpen.value = true
}

// Status control: Done on an activity type (has fields, captures location, or logs-complete) routes
// through our complete flow with the exact task.name; everything else is a native status flip.
function onStatus(status, task) {
  if (status === task.status) return
  const cfg = typeConfig(task.task_type)
  const needsForm =
    status === 'Done' && cfg && (cfg.fields?.length || cfg.captures_location || cfg.is_logged_complete)
  if (needsForm) openComplete(task, cfg)
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

// --- Create (ad-hoc punch) — this board owns the flow; window bridge is the sibling seam to the header.
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

async function chooseType(t) {
  let cfg
  try {
    cfg = await call('tatva_connect.activity.api.type_config', { task_type: t.name })
  } catch (e) {
    toast.error((e && (e.messages?.[0] || e.message)) || __('Could not load this activity.'))
    return
  }
  pickerOpen.value = false
  selected.value = { name: null, title: t.label || t.name, task_type: t.name, status: 'Todo', values: {}, location: null }
  selectedConfig.value = cfg
  modalMode.value = 'create'
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
  resetTaskFilter()
})

defineExpose({ reload: () => board.reload(), openCreate })
</script>
