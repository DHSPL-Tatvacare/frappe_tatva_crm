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

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="task in cards"
        :key="task.name"
        class="tc-task-card flex h-[92px] cursor-pointer items-stretch gap-3 rounded-lg border border-outline-gray-2 bg-surface-white p-3 transition hover:bg-surface-gray-1"
        @click="openView(task)"
      >
        <div class="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div class="flex items-center gap-1.5">
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

          <div class="flex items-center gap-1.5 pl-0.5 text-xs text-ink-gray-6">
            <span class="truncate">{{ task.rep_name }}</span>
            <DotIcon class="h-2.5 w-2.5 shrink-0 text-ink-gray-4" :radius="2" />
            <span class="shrink-0">{{ task.datetime }}</span>
            <template v-if="task.priority">
              <DotIcon class="h-2.5 w-2.5 shrink-0 text-ink-gray-4" :radius="2" />
              <span class="shrink-0">{{ task.priority }}</span>
            </template>
          </div>

          <div class="flex items-center gap-1.5 pl-0.5">
            <Badge v-if="task.task_type" variant="subtle" theme="gray" size="sm" :label="task.task_type" />
            <Badge v-if="task.location" variant="subtle" theme="green" size="sm" :label="__('Located')" />
          </div>
        </div>

        <!-- Media slot adapts to the task: captured map · attachment preview/icon · location-pending
             pin (only for location-tracked types) · else a clean type icon. -->
        <div class="h-full w-[116px] shrink-0">
          <TatvaMiniMap
            v-if="task.media.kind === 'map'"
            :lat="task.location.lat"
            :lng="task.location.lng"
            :provider="mapCfg.thumbnail"
            :zoom="mapCfg.zoom"
            :tile-url="mapCfg.tile_url"
            class="h-full w-full"
          />
          <img
            v-else-if="task.media.kind === 'image'"
            :src="task.media.src"
            alt=""
            loading="lazy"
            class="h-full w-full rounded-md object-cover"
          />
          <div
            v-else
            class="flex h-full w-full flex-col items-center justify-center gap-1 rounded-md bg-surface-gray-2 text-ink-gray-4"
          >
            <FeatherIcon :name="task.media.icon" class="h-5 w-5" />
            <span v-if="task.media.label" class="px-1 text-center text-[10px] leading-tight">
              {{ task.media.label }}
            </span>
          </div>
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
import { createResource, call, toast, Badge, Button, Dropdown, Dialog, FormControl, FeatherIcon } from 'frappe-ui'
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import DotIcon from '@/components/Icons/DotIcon.vue'
import TatvaMiniMap from '@/tatva/TatvaMiniMap.vue'
import TatvaTaskModal from '@/tatva/TatvaTaskModal.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
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

const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?.*)?$/i

// Files this task captured through its type's Attach fields — read from the SCHEMA (fieldtype), never
// a hardcoded type/field list. So any type that gains an Attach field gets attachment media for free.
function attachUrls(task) {
  const cfg = typeConfig(task.task_type)
  if (!cfg) return []
  return cfg.fields
    .filter((f) => f.fieldtype === 'Attach' || f.fieldtype === 'Attach Image')
    .map((f) => task.values?.[f.fieldname])
    .filter(Boolean)
}

// What the card's right slot shows, DERIVED from the task + its type config (no per-type rules):
// captured map → attachment image preview → attachment count → location-pending pin (only when the
// type tracks location) → a neutral activity icon. Presentation only; the decision comes from config.
function cardMedia(task) {
  if (task.location) return { kind: 'map' }
  const files = attachUrls(task)
  const image = files.find((u) => IMG_EXT.test(u))
  if (image) return { kind: 'image', src: image }
  if (files.length)
    return { kind: 'attach', icon: 'paperclip', label: `${files.length} ${files.length > 1 ? __('files') : __('file')}` }
  if (typeConfig(task.task_type)?.captures_location) return { kind: 'pin', icon: 'map-pin', label: __('No location') }
  return { kind: 'icon', icon: 'activity' }
}

const cards = computed(() => tasks.value.map((t) => ({ ...t, media: cardMedia(t) })))

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
})

defineExpose({ reload: () => board.reload(), openCreate })
</script>
