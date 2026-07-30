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
        <Button :label="exitLabel" :disabled="saving" @click="cancel" />
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
    <!-- min-h-0 or this flex child sizes to its CONTENT and the palette runs off the bottom unscrollable. -->
    <template v-else-if="workflow.data">
      <!-- Graph-level faults name no node, so the canvas cannot badge them; they were counted and shown
           nowhere. The banner's theme is the backend's severity: red when anything BLOCKS, amber when the
           graph is publishable and only WARNS remain (the engine being off). -->
      <Alert
        v-if="bannerProblems.length"
        class="mx-4 mt-3 shrink-0"
        :theme="bannerTheme"
        :title="bannerTitle"
      >
        <template #description>
          <ul class="list-inside list-disc text-ink-gray-7">
            <li v-for="(p, i) in bannerProblems" :key="i">
              {{ p.message }}
              <span v-if="p.fix" class="text-ink-gray-5"> — {{ p.fix }}</span>
            </li>
          </ul>
        </template>
      </Alert>

      <div class="min-h-0 flex-1">
        <WorkflowCanvas
          ref="canvasRef"
          :key="canvasKey"
          :definition="workflow.data"
          :editable="editable"
          :problems="problems"
        />
      </div>
    </template>
  </div>
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import WorkflowCanvas from './WorkflowCanvas.vue'
import {
  Alert,
  Breadcrumbs,
  Badge,
  Button,
  LoadingIndicator,
  Tooltip,
  createResource,
  call,
  toast,
} from 'frappe-ui'
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { createDialog } from '@/utils/dialogs'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

const props = defineProps({
  workflowId: { type: String, required: true },
})

// Backend method lives in tatva_connect (mirrors near_me/smartview);
// `auto` is the single trigger and the cache key carries the record: App.vue keys router-view on
// $route.fullPath, so another workflow is another mount and the key is rebuilt with it (§8, §13).
const workflow = createResource({
  url: 'tatva_connect.workflows.api.get_workflow',
  makeParams: () => ({ name: props.workflowId }),
  cache: ['Workflow', props.workflowId],
  auto: true,
})

const title = computed(() => workflow.data?.workflow_name || props.workflowId)

// Leaving means two things: Cancel discards unsaved work, Done merely leaves when there is none.
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

// Faults with no node of their own — the canvas badges nodes, so these need somewhere else to be seen.
const graphProblems = computed(() => problems.value.filter((p) => !p.node_id))
// ONE verdict, read by everything, so the status badge, the banner and the node badges can never tell the
// author three different things. `blocks` is exactly what the backend refuses a publish on — so `isBlocked`
// is true precisely when the lifecycle DID NOT advance (the status stays Draft). A node-level block is
// badged on its node, not in this banner, but it still refused the publish, so the banner's own words must
// follow the same verdict rather than re-deciding from the graph-level subset. The canvas renders the
// answer, it never computes a second one (C17.1).
const isBlocked = computed(() => problems.value.some((p) => p.severity === 'blocks'))
const bannerTheme = computed(() => (isBlocked.value ? 'red' : 'amber'))
const bannerTitle = computed(() =>
  isBlocked.value
    ? __('This workflow cannot be published yet')
    : __('Published — but it will not run yet'),
)
// The banner's CONTENT follows the same verdict: while blocked it speaks only to graph-level blockers (a
// node-level block is badged on its node, and a warning is moot until the graph can publish at all); once
// published it speaks to the warnings that remain. So the banner never lists a reason that contradicts its
// own title.
const bannerProblems = computed(() =>
  isBlocked.value
    ? graphProblems.value.filter((p) => p.severity === 'blocks')
    : graphProblems.value,
)

// Names the first fault and counts the rest; graph-level leads, since node faults are already badged.
function publishRefusal(found) {
  const ordered = [...found.filter((p) => !p.node_id), ...found.filter((p) => p.node_id)]
  const first = ordered[0]?.message || __('The graph is not ready.')
  return ordered.length > 1
    ? __('{0} — and {1} more to fix', [first, ordered.length - 1])
    : first
}

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

// Publish faults as {node_id, field, message}; cleared on any successful move and on entering edit.
const problems = ref([])

// The lifecycle, as the backend declares it.
const LIFECYCLE = {
  Draft: [{ action: 'publish', label: 'Publish', primary: true, confirm: 'Freeze this graph as a new version? It will not run until you activate it.' }],
  Published: [
    { action: 'activate', label: 'Activate', primary: true, theme: 'green', confirm: 'Arm this workflow? From now on a matching event starts a journey.' },
    { action: 'revise', label: 'Revise' },
  ],
  Active: [
    { action: 'suspend', label: 'Suspend', theme: 'orange', confirm: 'Stop starting new journeys? Journeys already under way keep going on the version they started on.' },
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
    await call('tatva_connect.workflows.api.save_draft', {
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
// The canvas owns its own graph, so it owns the answer: dirty is DERIVED there from content + completed
// drags, never polled and never mirrored here. A second snapshot in this file would be a second opinion.
const dirtyNow = computed(() => canvasRef.value?.dirty ?? false)

function isDirty() {
  return dirtyNow.value
}

function markClean() {
  canvasRef.value?.markClean()
}

// Refresh and tab-close use the browser's own prompt — the only thing that can block them.
function beforeUnloadHandler(event) {
  if (!isDirty()) return
  event.preventDefault()
  event.returnValue = true
}

onMounted(() => addEventListener('beforeunload', beforeUnloadHandler))
onUnmounted(() => removeEventListener('beforeunload', beforeUnloadHandler))

// `beforeunload` cannot see an SPA route change, so in-app navigation needs the router's own guard.
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
  // Refuse and let Discard re-issue it: createDialog has no dismiss callback, so holding `next` hangs.
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
    const result = await call(`tatva_connect.workflows.api.${verb.action}`, { name: props.workflowId })
    // A graph that is not ready comes back as DATA, not as an error: the nodes it names are marked on
    // the canvas, and the author is told how many there are rather than being handed one toast per fault.
    if (result && result.ok === false) {
      problems.value = result.problems || []
      // Say WHY, not just how many. A count sends the author hunting: node-level faults are badged on the
      // canvas, but a graph-level one names no node, so "3 problems" could point at something they had no
      // way to find. The first fault is named outright and the rest are counted.
      toast.error(publishRefusal(problems.value))
      return
    }
    // A publish can succeed AND carry warnings (the engine is off). Keep the warns so the amber banner
    // still tells the author their workflow is published but mute; a clean move carries none and clears it.
    problems.value = result?.problems || []
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
  // Wait for editable before reading the graph, or the baseline is null and the first change is missed.
  nextTick(markClean)
}

async function cancel() {
  editable.value = false
  await workflow.reload()
  canvasKey.value++ // discard in-canvas moves by re-hydrating from the stored doc
}
</script>
