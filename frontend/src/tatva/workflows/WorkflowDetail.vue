<!-- TATVA: Workflow detail = the orchestration canvas. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs
        :items="[
          { label: __('Workflows'), route: { name: 'Workflows' } },
          { label: title },
        ]"
      />
    </template>
    <template #right-header>
      <div v-if="workflow.data" class="flex items-center gap-2">
        <Badge
          :theme="stateTheme"
          :label="__(workflow.data.lifecycle_state || 'Draft')"
        />
        <Tooltip v-if="version" :text="versionDetail">
          <span class="font-mono text-xs text-ink-gray-5">{{ versionLabel }}</span>
        </Tooltip>
        <span v-else class="text-xs italic text-ink-gray-4">{{ __('never published') }}</span>
      </div>
      <template v-if="editable">
        <Button :label="exitLabel" @click="cancel" :disabled="saving" />
        <Button
          variant="solid"
          :label="__('Save')"
          iconLeft="check"
          :loading="saving"
          @click="save"
        />
      </template>
      <template v-else-if="workflow.data">
        <Button
          v-if="isDraft"
          :label="__('Edit')"
          iconLeft="edit"
          @click="startEditing"
        />
        <Button
          v-for="verb in transitions"
          :key="verb.action"
          :variant="verb.primary ? 'solid' : 'subtle'"
          :theme="verb.theme"
          :label="__(verb.label)"
          :loading="moving === verb.action"
          @click="confirmMove(verb)"
        />
      </template>
    </template>
  </LayoutHeader>

  <div class="flex flex-1 flex-col overflow-hidden">
    <div v-if="workflow.loading" class="flex flex-1 items-center justify-center">
      <LoadingIndicator class="h-6 w-6 text-ink-gray-5" />
    </div>
    <!-- min-h-0 or this flex child grows to its CONTENT instead of its container: the palette then runs
         off the bottom of the screen without scrolling, and Vue Flow's own controls and minimap end up
         below the fold. Same rule as the min-w-0 on the canvas, one axis over. -->
    <div v-else-if="workflow.data" class="min-h-0 flex-1">
      <WorkflowCanvas
        ref="canvasRef"
        :key="canvasKey"
        :definition="workflow.data"
        :editable="editable"
        :problems="problems"
      />
    </div>
  </div>
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import WorkflowCanvas from './WorkflowCanvas.vue'
import {
  Breadcrumbs,
  Badge,
  Button,
  LoadingIndicator,
  Tooltip,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { createDialog } from '@/utils/dialogs'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

const props = defineProps({
  workflowId: { type: String, required: true },
})

// Backend method lives in tatva_connect (mirrors near_me/smartview);
const workflow = createResource({
  url: 'tatva_connect.campaigns.api.get_campaign',
  params: { name: props.workflowId },
  cache: ['Workflow', props.workflowId],
  auto: true,
})

const title = computed(() => workflow.data?.workflow_name || props.workflowId)

// Lifecycle state drives the header badge, and Edit shows only on a Draft — the backend law.
// WHICH graph is live. A Published badge only says a version exists — it does not say whether the
// version running is the graph on screen, which is exactly the question an author has after editing.
// Leaving the editor means two different things and must not wear one label. With unsaved work it
// DISCARDS, so it says Cancel; with everything saved it merely leaves, so it says Done. Calling it
// Cancel when there is nothing to cancel makes an author afraid to click the only way out.
const exitLabel = computed(() => (dirtyNow.value ? __('Cancel') : __('Done')))

const version = computed(() => workflow.data?.version || null)
const versionLabel = computed(() =>
  version.value ? `v${version.value.version_no} · ${version.value.hash}` : '',
)
const versionDetail = computed(() =>
  version.value
    ? __('Version {0} — {1} nodes, frozen {2}', [
        version.value.version_no,
        version.value.node_count,
        version.value.created,
      ])
    : '',
)

const isDraft = computed(() => (workflow.data?.lifecycle_state || 'Draft') === 'Draft')
const stateTheme = computed(
  () =>
    ({ Draft: 'gray', Published: 'blue', Active: 'green', Suspended: 'orange', Archived: 'red' })[
      workflow.data?.lifecycle_state
    ] || 'gray',
)

const router = useRouter()
const editable = ref(false)
const saving = ref(false)
const moving = ref(null)

// Publish faults, as {node_id, field, message}. Held so the canvas can mark the offending nodes and the
// author can see them all at once — cleared on any successful move and on entering edit.
const problems = ref([])

// The lifecycle, as the backend declares it.
const LIFECYCLE = {
  Draft: [{ action: 'publish', label: 'Publish', primary: true, confirm: 'Freeze this graph as a new version? It will not run until you activate it.' }],
  Published: [
    { action: 'activate', label: 'Activate', primary: true, theme: 'green', confirm: 'Arm this workflow? From now on a matching event starts a run.' },
    { action: 'revise', label: 'Revise' },
  ],
  Active: [
    { action: 'suspend', label: 'Suspend', theme: 'orange', confirm: 'Stop starting new runs? Runs already under way keep going on the version they started on.' },
    { action: 'revise', label: 'Revise' },
  ],
  Suspended: [
    { action: 'activate', label: 'Activate', primary: true, theme: 'green', confirm: 'Arm this workflow again?' },
    { action: 'revise', label: 'Revise' },
    { action: 'archive', label: 'Archive', theme: 'red', confirm: 'Retire this workflow for good? This cannot be undone.' },
  ],
  Archived: [],
}

const transitions = computed(() =>
  editable.value ? [] : LIFECYCLE[workflow.data?.lifecycle_state || 'Draft'] || [],
)
const canvasRef = ref(null)
const canvasKey = ref(0)

// Poll the canvas while editing: Vue Flow owns node positions internally, so there is nothing reactive
// to watch for a drag. Cheap, and only while the editor is open.
let dirtyTimer = null
watch(editable, (on) => {
  clearInterval(dirtyTimer)
  if (on) dirtyTimer = setInterval(() => (dirtyNow.value = isDirty()), 500)
  else dirtyNow.value = false
})
onUnmounted(() => clearInterval(dirtyTimer))

async function save() {
  if (!canvasRef.value) return
  const graph = canvasRef.value.serialize()
  if (!graph) {
    // The editor never finished loading, so what is on screen is not this workflow. Saving here would
    // persist an empty graph over a real one.
    toast.error(__('The editor has not finished loading. Reload before saving.'))
    return
  }
  const { nodes, canvas } = graph
  saving.value = true
  try {
    // Draft-only save: persists the graph + layout, mints no Version, arms nothing.
    await call('tatva_connect.campaigns.api.save_draft', {
      name: props.workflowId,
      nodes: JSON.stringify(nodes),
      canvas_json: JSON.stringify(canvas),
    })
    markClean()
    toast.success(__('Draft saved'))
    // Stay in edit mode. Saving is a checkpoint, not a decision to stop working — dropping the author
    // out of the editor after every save made them click Edit again to carry on, and lost the canvas
    // selection each time. Leaving edit mode is what Cancel is for.
    await workflow.reload()
  } catch (e) {
    const msgs = e?.messages?.length ? e.messages : [e?.message || __('Save failed')]
    msgs.forEach((m) => toast.error(m))
  } finally {
    saving.value = false
  }
}


// --- unsaved work is guarded, both ways out of the page ---------------------------------------------
// The graph the author last committed, as text. Anything different is unsaved work.
const baseline = ref(null)

function snapshot() {
  if (!canvasRef.value) return null
  const { nodes, canvas } = canvasRef.value.serialize()
  return JSON.stringify({ nodes, canvas })
}

function markClean() {
  baseline.value = snapshot()
  dirtyNow.value = false
}

// Reactive mirror of isDirty(), for anything that must RENDER differently when there is unsaved work.
// `isDirty()` reads the live canvas, so it is a function for the guards; this tracks it for the UI.
const dirtyNow = ref(false)

function isDirty() {
  if (!editable.value || !canvasRef.value) return false
  return baseline.value !== null && snapshot() !== baseline.value
}

// Refresh and tab-close: the browser's own prompt, which is the only thing that can block them. Same
// handler shape as SlaPolicyView / AssignmentRuleView — the platform's answer, not a new one.
function beforeUnloadHandler(event) {
  if (!isDirty()) return
  event.preventDefault()
  event.returnValue = true
}

onMounted(() => addEventListener('beforeunload', beforeUnloadHandler))
onUnmounted(() => removeEventListener('beforeunload', beforeUnloadHandler))

// In-app navigation: the router's own guard, and the app's one dialog host. `beforeunload` cannot see a
// route change, so without this, clicking away in the SPA loses the graph with no prompt at all.
onBeforeRouteLeave((to) => {
  if (!isDirty()) return true
  createDialog({
    title: __('Leave without saving?'),
    message: __('This workflow has changes that have not been saved. They will be lost.'),
    actions: [
      {
        label: __('Discard changes'),
        variant: 'solid',
        theme: 'red',
        onClick: (close) => {
          close()
          markClean()
          router.push(to.fullPath)
        },
      },
    ],
  })
  // Refuse the navigation and let the dialog re-issue it on Discard. `createDialog` exposes no
  // close/dismiss callback, so a guard that held `next` would hang the router for ever the moment the
  // author dismissed the dialog instead of answering it. Staying put is also the safer default.
  return false
})

// §4 — a lifecycle move is not undoable by a second click; it asks first, through the app's one host.
function confirmMove(verb) {
  if (!verb.confirm) return move(verb)
  createDialog({
    title: __(verb.label),
    message: __(verb.confirm),
    actions: [
      {
        label: __(verb.label),
        variant: 'solid',
        onClick: (close) => {
          close()
          return move(verb)
        },
      },
    ],
  })
}

async function move(verb) {
  moving.value = verb.action
  try {
    const result = await call(`tatva_connect.campaigns.api.${verb.action}`, { name: props.workflowId })
    // A graph that is not ready comes back as DATA, not as an error: the nodes it names are marked on
    // the canvas, and the author is told how many there are rather than being handed one toast per fault.
    if (result && result.ok === false) {
      problems.value = result.problems || []
      toast.error(
        __('{0} problems must be fixed first', [problems.value.length]),
      )
      return
    }
    problems.value = []
    await workflow.reload()
    toast.success(__('{0} done', [__(verb.label)]))
  } catch (e) {
    const msgs = e?.messages?.length ? e.messages : [e?.message || __('That did not work')]
    msgs.forEach((m) => toast.error(m))
  } finally {
    moving.value = null
  }
}

function startEditing() {
  editable.value = true
  problems.value = []
  // Wait for the canvas to become editable before reading its graph, or the baseline is null and the
  // first change after entering edit mode would not register as dirty.
  nextTick(markClean)
}

async function cancel() {
  editable.value = false
  baseline.value = null
  await workflow.reload()
  canvasKey.value++ // discard in-canvas moves by re-hydrating from the stored doc
}
</script>
