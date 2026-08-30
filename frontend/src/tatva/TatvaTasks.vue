<!-- TatvaTasks — the config-driven Tasks board for a CRM Lead: renders <Activities>' `kind: 'task'` page through ActivityCard under day headings, and routes card click → VIEW, Done-on-a-typed-task → COMPLETE, "Log Activity" → picker → CREATE. -->
<template>
  <div class="flex flex-1 flex-col">
    <!-- the native Data tab's loading state (Activities/DataFields.vue), verbatim — the same one DetailPanel uses, so a lead's tabs do not each load differently -->
    <div
      v-if="loading"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-xl font-medium text-ink-gray-6"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span>{{ __('Loading...') }}</span>
    </div>

    <!-- An empty page means two different things, so it says which: nothing here yet, or nothing left after the narrowing the server applied. -->
    <div
      v-else-if="!cards.length && narrowed"
      class="flex flex-1 items-center justify-center text-base text-ink-gray-5"
    >
      {{ __('No tasks match the filter.') }}
    </div>

    <div v-else-if="!cards.length" class="relative flex-1">
      <EmptyState
        name="tasks"
        :title="__('No tasks yet')"
        :description="__('Create a task to get started.')"
        :icon="TaskIcon"
      />
    </div>

    <!-- One stream under day headings over the shared ActivityCard; the heading is the only separation and the card never changes (U9). -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="group in grouped"
        :key="group.key"
        class="flex flex-col gap-2"
      >
        <div
          class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5"
        >
          <span>{{ group.label }}</span>
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

    <!-- The ONE task modal; "Log Activity" is this same create form with the type passed in. `v-if` gives a fresh modal per open. -->
    <TaskModal
      v-if="modalOpen"
      v-model="modalOpen"
      :task="selected"
      :lead="lead"
      :mode="modalMode"
      :default-type="createType"
      @saved="emit('changed')"
    />

    <!-- "Log Activity" — a grain-scoped searchable type list; picking one opens TaskModal preselected. -->
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
        <div class="flex flex-col gap-0.5 overflow-auto sm:max-h-[50dvh]">
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
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
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
import { statusTheme } from '@/tatva/taskStatus.js'
import { DUE_BUCKETS, dueBadge, dueBucket } from '@/tatva/taskDue.js'
import { dayLabel, taskStatusOptions } from '@/utils'

// A RENDERER, not a data path: <Activities> pages, searches, filters and sorts; this board adds only the day separation.
const props = defineProps({
  lead: { type: String, default: '' },
  tasks: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['changed'])

// `due_state` is derived (overdue moves with the clock) and carries the server's bucket VALUE, never the translated label.
const tasks = computed(() =>
  props.tasks.map((t) => ({ ...t, due_state: dueValue(t) })),
)

const DUE_VALUE = Object.fromEntries(DUE_BUCKETS.map((b) => [b.key, b.value]))
const dueValue = (task) => DUE_VALUE[dueBucket(task)]

// The page as it arrived — search, filter, sort and paging all happened on the server (D1).
const cards = computed(() => tasks.value)
const narrowed = computed(
  () => !!activityToolbar.search.trim() || !!activityToolbar.predicate,
)

// A task → the four-slot card shape: status lives in the tile, so the badge carries the terminal outcome or the Task Status.
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
    // Closed → its status; open → its Task Status.
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
    dimmed: false, // TATVA: the Done badge already says the state; fading the row just made history hard to read.
  }
}

// ONE stream, newest first, split by the DAY a task was raised; rows arrive `creation desc`, so this is a walk not a sort.
const grouped = computed(() => {
  const out = []
  for (const t of cards.value) {
    const key = String(t.creation).slice(0, 10)
    if (!out.length || out[out.length - 1].key !== key)
      out.push({ key, label: dayLabel(t.creation), rows: [] })
    out[out.length - 1].rows.push(t)
  }
  return out
})

const selected = ref(null)
const modalMode = ref('view')
const modalOpen = ref(false)
const createType = ref('') // preselected type for the "Log Activity" direct path (else free-flow create)

// Card click → view the exact task; TaskModal loads it fully by name.
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

// Done on a type that needs capture routes through the complete flow; everything else is a native status flip.
function onStatus(status, task) {
  if (status === task.status) return
  // `needs_capture` rides on the row — the server answered it once for the whole page.
  if (status === 'Done' && task.needs_capture) openComplete(task)
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
    emit('changed')
  } catch (e) {
    toast.error(
      (e && (e.messages?.[0] || e.message)) || __('Could not update the task.'),
    )
  }
}

// "Log Activity" → the grain-scoped type list; picking a type opens TaskModal preselected to it.
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
  createType.value = t.name // composite PK — TaskModal preselects it
  modalMode.value = 'create' // the SAME create form, opened with its type already chosen
  modalOpen.value = true
}

// Bridges: the header "Log Activity" item calls openCreate; ad-hoc punches refresh via __tcReloadTasks.
onMounted(() => {
  window.__tcLogActivity = () => openCreate()
  window.__tcReloadTasks = () => emit('changed')
})
onBeforeUnmount(() => {
  if (window.__tcLogActivity) delete window.__tcLogActivity
  if (window.__tcReloadTasks) delete window.__tcReloadTasks
})

defineExpose({ reload: () => emit('changed'), openCreate })
</script>
