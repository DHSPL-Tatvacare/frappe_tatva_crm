<!-- TATVA: Workflow detail = the orchestration canvas. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="flex items-center gap-2">
        <Breadcrumbs
          :items="[
            { label: __('Workflows'), route: { name: 'Workflows' } },
            { label: title },
          ]"
        />
        <!-- The state HUGS the name: it is a fact about this workflow, and at the far right of a wide header it read as unrelated to the thing it describes. -->
        <Badge
          v-if="workflow.data && !editable"
          :theme="stateTheme"
          :label="__(workflow.data.lifecycle_state || 'Draft')"
        />
      </div>
    </template>
    <template #right-header>
      <!-- Editing is a different screen and looks like one: the state pill and every lifecycle verb go, and what is left says whether the work on the canvas is committed. -->
      <template v-if="editable">
        <span class="flex items-center gap-1 text-xs text-ink-gray-5">
          <FeatherIcon name="edit-2" class="h-3 w-3" />
          {{ editStatus }}
        </span>
        <Button :label="exitLabel" :disabled="saving" @click="cancel" />
        <!-- No tick: a tick means DONE and this is the pending action; dead while there is nothing to save, which is the honest signal the tick was imitating. -->
        <Button
          variant="solid"
          :label="__('Save')"
          :disabled="!dirtyNow || saving"
          :loading="saving"
          @click="save"
        />
      </template>
      <template v-else-if="workflow.data">
        <!-- What this workflow actually DOES, read off the doc the page already loaded. -->
        <span class="hidden text-xs text-ink-gray-5 sm:inline">{{ subtitle }}</span>
        <!-- The version is a button, and the detail an operator rarely needs (the hash, the node count, the freeze date) lives inside it rather than on the surface. -->
        <Popover v-if="version">
          <template #target="{ togglePopover }">
            <Button
              variant="ghost"
              :label="versionLabel"
              iconRight="chevron-down"
              @click="togglePopover()"
            />
          </template>
          <template #body-main>
            <div class="flex flex-col gap-1 p-3 text-xs text-ink-gray-6">
              <div>{{ __('{0} nodes', [version.node_count]) }}</div>
              <div>{{ __('Frozen {0}', [version.created]) }}</div>
              <div class="font-mono text-ink-gray-4">{{ version.hash }}</div>
            </div>
          </template>
        </Popover>
        <span v-else class="text-xs italic text-ink-gray-4">{{ __('never published') }}</span>
        <!-- A page, not a modal: the run list is a list and gets the CRM's own list machinery, which is keyed to a route. -->
        <router-link :to="{ name: 'WorkflowRuns', params: { workflowId } }">
          <Button :label="__('Runs')" />
        </router-link>
        <!-- Only while a cohort is actually walking. `drain.abort` was built and tested with no way to
             reach it, so an operator watching a cohort go wrong had the bench console and nothing else.
             The state is already on the loaded workflow — no second fetch to tell whether to show it. -->
        <Button
          v-if="isDraining"
          theme="red"
          :label="__('Stop cohort')"
          :loading="aborting"
          @click="confirmAbortCohort"
        />
        <!-- ONE primary verb, the same word in every state. Edit and Revise were two doors to one room. -->
        <Button
          variant="solid"
          :label="__('Edit')"
          :loading="moving === 'revise'"
          @click="editWorkflow"
        />
        <!-- The lifecycle lives behind the overflow, and what KILLS journeys sits below its own divider — a destructive verb must not be the loudest thing on the screen. -->
        <Dropdown v-if="lifecycleGroups.length" :options="lifecycleGroups">
          <Button variant="ghost" icon="more-horizontal" :tooltip="__('More')" />
        </Dropdown>
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
  Dropdown,
  FeatherIcon,
  LoadingIndicator,
  Popover,
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

// The exit says WHICH thing it does. It read `Done` when clean, immediately beside `Save` — two verbs a
// clean draft offers with no way to tell which commits, so leaving could be mistaken for saving.
const exitLabel = computed(() => (dirtyNow.value ? __('Discard changes') : __('Close')))

const version = computed(() => workflow.data?.version || null)
// The version, and nothing else: the content hash means nothing to an operator and cost the header its one legible slot, so it now sits inside the button beside the node count and the freeze date.
const versionLabel = computed(() => (version.value ? `v${version.value.version_no}` : ''))

// A grain master's primary key is composite (`vertical::group::program`); the leaf is what a person reads.
const leafOf = (key) => String(key || '').split('::').pop()

// The three things the header never said: what it watches, on which save, and for whom. All on the doc.
const subtitle = computed(() => {
  const d = workflow.data || {}
  const trigger = [d.trigger_doctype, d.trigger_mode, d.trigger_event].filter(Boolean).join(' · ')
  const grain = [d.trigger_vertical, d.trigger_group, d.trigger_program].filter(Boolean).map(leafOf).join(' / ')
  return [trigger && __('on {0}', [trigger]), grain].filter(Boolean).join('   ')
})

// Edit mode says whether the canvas work is committed — the same fact the Save button is disabled by.
const editStatus = computed(() =>
  dirtyNow.value
    ? __('Editing draft — unsaved changes')
    : __('Editing draft — all changes saved'),
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
const aborting = ref(false)

// `Draining` is the drain's own word for "a cohort is walking right now" — read off the workflow the page
// already loaded, never asked for separately.
const isDraining = computed(() => workflow.data?.cohort_state === 'Draining')

// Publish faults as {node_id, field, message}; cleared on any successful move and on entering edit.
const problems = ref([])

// The lifecycle, as the backend declares it; `revise` is deliberately absent because it and Edit were the same door under two names, so the ONE Edit verb owns that transition (see `editWorkflow`).
const LIFECYCLE = {
  Draft: [{ action: 'publish', label: 'Publish', confirm: 'Freeze this graph as a new version? It will not run until you activate it.' }],
  Published: [
    { action: 'activate', label: 'Activate', confirm: 'Arm this workflow? From now on a matching event starts a journey.' },
  ],
  Active: [
    // `retires`: the verb KILLS, so the question names how many journeys die — a number only known once
    // asked for, which is why these carry no plain `confirm` string. `confirmRetire` writes the message.
    { action: 'suspend', label: 'Suspend', retires: true },
  ],
  Suspended: [
    { action: 'activate', label: 'Activate', confirm: 'Arm this workflow again?' },
    { action: 'archive', label: 'Archive', retires: true, confirm: 'This cannot be undone.' },
  ],
  Archived: [],
}

const transitions = computed(() =>
  editable.value ? [] : LIFECYCLE[workflow.data?.lifecycle_state || 'Draft'] || [],
)

// The overflow's two groups, which is how the divider between them is drawn: what moves the workflow forward, then what stops it — and a group with no verbs is absent rather than empty.
const lifecycleGroups = computed(() => {
  const item = (verb) => ({ label: __(verb.label), onClick: () => confirmMove(verb) })
  const forward = transitions.value.filter((v) => !v.retires).map(item)
  const retiring = transitions.value.filter((v) => v.retires).map(item)
  return [
    forward.length && { group: __('Lifecycle'), hideLabel: true, items: forward },
    retiring.length && { group: __('Stops the workflow'), items: retiring },
  ].filter(Boolean)
})
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

// ONE question for "you are about to lose unsaved canvas work", however the author leaves — routed away or
// dropping the edits in place. Same work destroyed, so the same words; a second wording is a second answer.
function confirmDiscard(onDiscard) {
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
          onDiscard()
        },
      },
    ],
  })
}

// `beforeunload` cannot see an SPA route change, so in-app navigation needs the router's own guard.
onBeforeRouteLeave((to) => {
  if (!isDirty()) return true
  confirmDiscard(() => {
    markClean()
    router.push(to.fullPath)
  })
  // Refuse and let Discard re-issue it: createDialog has no dismiss callback, so holding `next` hangs.
  return false
})

// §4 — a lifecycle move is not undoable by a second click; it asks first, through the app's one host.
function confirmMove(verb) {
  if (verb.retires) return confirmRetire(verb)
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

// Retiring is KILLING, and the count is the difference between a mistake and an incident: "this will stop
// 3,140 journeys" is a decision, "suspend?" is a guess. Asked at CLICK time and not on the page (§A.4) —
// the number is only true at the moment of the question, and every other visitor would pay for it unread.
// One function for every retiring verb, driven by `verb.retires`, because Suspend and Archive now do the
// same thing to journeys and a second copy would drift the day one of them changed.
async function confirmRetire(verb) {
  moving.value = verb.action
  let count
  try {
    count = await call('tatva_connect.workflows.api.live_journey_count', {
      name: props.workflowId,
    })
  } catch (e) {
    toast.error(e?.message || __('Could not count the journeys in flight'))
    return
  } finally {
    moving.value = null
  }
  createDialog({
    title: __('{0} this workflow', [__(verb.label)]),
    // Deliberately not "everything stops": a message already handed to the provider has no job id to
    // cancel by and will complete. Saying otherwise would be a promise the queue cannot keep.
    message: [
      count
        ? __(
            'This will stop {0} journeys in flight, and they cannot be restarted. A message or call already sent will still arrive; nothing after it runs.',
            [count],
          )
        : __('No journeys are in flight. New ones will stop starting.'),
      verb.confirm && __(verb.confirm),
    ]
      .filter(Boolean)
      .join(' '),
    actions: [
      {
        label: __(verb.label),
        variant: 'solid',
        theme: 'red',
        onClick: (close) => {
          close()
          return move(verb)
        },
      },
    ],
  })
}

// Stopping the FACTORY, not the journeys it already made — two different acts, so two different buttons
// and a message that says which one this is.
function confirmAbortCohort() {
  createDialog({
    title: __('Stop cohort'),
    message: __(
      'The cohort stops adding journeys at its next batch. Journeys it has already started keep going — suspend the workflow to end those.',
    ),
    actions: [
      {
        label: __('Stop cohort'),
        variant: 'solid',
        theme: 'red',
        onClick: (close) => {
          close()
          return abortCohort()
        },
      },
    ],
  })
}

async function abortCohort() {
  aborting.value = true
  try {
    await call('tatva_connect.workflows.api.abort_cohort', { name: props.workflowId })
    await workflow.reload()
    toast.success(__('The cohort will stop at its next batch'))
  } catch (e) {
    toast.error(e?.message || __('That did not work'))
  } finally {
    aborting.value = false
  }
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
      return false
    }
    // A publish can succeed AND carry warnings (the engine is off). Keep the warns so the amber banner
    // still tells the author their workflow is published but mute; a clean move carries none and clears it.
    problems.value = result?.problems || []
    await workflow.reload()
    toast.success(verb.done ? __(verb.done) : __('{0} done', [__(verb.label)]))
    return true
  } catch (e) {
    const msgs = e?.messages?.length ? e.messages : [e?.message || __('That did not work')]
    msgs.forEach((m) => toast.error(m))
    return false
  } finally {
    moving.value = null
  }
}

// ONE door into the editor: a Draft just opens, anything released goes back to Draft first, and that consequence is stated before it happens rather than discovered from a silent count — true in the code, because `_TRANSITIONS` allows ACTIVE → DRAFT and `RETIRED_STATES` deliberately excludes Draft, so journeys in flight finish on their frozen version while no new one ever starts.
function editWorkflow() {
  if (isDraft.value) return startEditing()
  createDialog({
    title: __('Edit this workflow'),
    message: __(
      'Editing stops new runs starting. Journeys already running finish on the frozen version.',
    ),
    actions: [
      {
        label: __('Edit'),
        variant: 'solid',
        onClick: (close) => {
          close()
          return reviseThenEdit()
        },
      },
    ],
  })
}

async function reviseThenEdit() {
  if (await move(REVISE)) startEditing()
}

// Carries its own `done` line: "Revise done" would name a verb this header no longer says out loud.
const REVISE = { action: 'revise', label: 'Edit', done: 'Back to a draft — edit, save, then publish again' }

function startEditing() {
  editable.value = true
  problems.value = []
  // Wait for editable before reading the graph, or the baseline is null and the first change is missed.
  nextTick(markClean)
}

// A clean editor just leaves; a dirty one would destroy the author's canvas work on one click, so it asks.
function cancel() {
  if (!isDirty()) return discard()
  confirmDiscard(discard)
}

async function discard() {
  editable.value = false
  await workflow.reload()
  canvasKey.value++ // discard in-canvas moves by re-hydrating from the stored doc
}
</script>
