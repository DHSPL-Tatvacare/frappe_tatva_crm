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
      <ProblemsPill :problems="problems" @focus="(id) => canvasRef?.focusNode(id)" />
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
        <!-- The house split button (ActivityHeader's): Runs, a routed list page opened in a new tab so the canvas is never left, with Versions and Activity behind the chevron. -->
        <div class="flex items-center">
          <router-link
            :to="{ name: 'Workflow Runs', params: { workflowId }, hash: '#runs' }"
            target="_blank"
          >
            <Button class="rounded-br-none rounded-tr-none" :label="__('Runs')" />
          </router-link>
          <Dropdown
            :options="[
              { label: __('Versions'), icon: 'git-branch', onClick: () => openRunsTab('#versions') },
              { label: __('Activity'), icon: 'activity', onClick: () => openRunsTab('#activity') },
            ]"
            placement="bottom-end"
            :button="{
              icon: 'chevron-down',
              class: '!w-6 justify-center rounded-bl-none rounded-tl-none border-l border-l-outline-gray-2 px-0',
            }"
          />
        </div>
        <!-- Only while a cohort is actually walking. `drain.abort` was built and tested with no way to reach it, so an operator watching a cohort go wrong had the bench console and nothing else. The state is already on the loaded workflow — no second fetch to tell whether to show it. -->
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

  <WorkflowNameDialog v-if="showDuplicate" v-model="showDuplicate" :source="workflow.data" />
  <WorkflowNameDialog v-if="showRename" v-model="showRename" :renaming="workflow.data" @renamed="workflow.reload()" />
</template>
<script setup>
import { lifecycleTheme } from './journeyStatus'
import ProblemsPill from './ProblemsPill.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import WorkflowCanvas from './WorkflowCanvas.vue'
import WorkflowNameDialog from './WorkflowNameDialog.vue'
import { workflowSubtitle } from './workflowLabels'
import {
  Breadcrumbs,
  Badge,
  Button,
  Dropdown,
  FeatherIcon,
  Popover,
  createResource,
  call,
  toast,
  usePageMeta,
} from 'frappe-ui'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import { getSettings } from '@/stores/settings'
import { ref, computed, nextTick } from 'vue'
import { createDialog } from '@/utils/dialogs'
import { LENS_CACHE_GENERATION } from '@/tatva/lensCache'
import { useUnsavedGuard } from '@/tatva/useUnsavedGuard'
import { useRouter } from 'vue-router'

const props = defineProps({
  workflowId: { type: String, required: true },
})

// Backend method lives in tatva_connect (mirrors near_me/smartview); `auto` is the single trigger and the cache key carries the record: App.vue keys router-view on $route.fullPath, so another workflow is another mount and the key is rebuilt with it (§8, §13).
const workflow = createResource({
  url: 'tatva_connect.workflows.api.get_workflow',
  makeParams: () => ({ name: props.workflowId }),
  // The generation `useNodeTypes.js:15` carries, for the same reason it carries it: a frappe-ui cache has no TTL and is mirrored to IndexedDB, so a browser that opened this workflow once would keep that payload for ever and a shape added on the server would never reach it. That is not hypothetical.
  cache: ['Workflow', props.workflowId, LENS_CACHE_GENERATION],
  auto: true,
})

const title = computed(() => workflow.data?.workflow_name || props.workflowId)
const { brand } = getSettings()
// The browser tab names the record, as a lead's page does.
usePageMeta(() => ({ title: title.value, icon: brand.favicon }))

// The exit says WHICH thing it does. It read `Done` when clean, immediately beside `Save` — two verbs a clean draft offers with no way to tell which commits, so leaving could be mistaken for saving.
const exitLabel = computed(() => (dirtyNow.value ? __('Discard changes') : __('Close')))

const version = computed(() => workflow.data?.version || null)
// The version, and nothing else: the content hash means nothing to an operator and cost the header its one legible slot, so it now sits inside the button beside the node count and the freeze date.
const versionLabel = computed(() => (version.value ? `v${version.value.version_no}` : ''))

// The three things the header never said: what it watches, on which save, and for whom. All on the doc, and built by the ONE labeller the runs page reads too.
const subtitle = computed(() => workflowSubtitle(workflow.data))

// Edit mode says whether the canvas work is committed — the same fact the Save button is disabled by.
const editStatus = computed(() =>
  dirtyNow.value
    ? __('Editing draft — unsaved changes')
    : __('Editing draft — all changes saved'),
)

const isDraft = computed(() => (workflow.data?.lifecycle_state || 'Draft') === 'Draft')
const stateTheme = computed(() => lifecycleTheme(workflow.data?.lifecycle_state))

const router = useRouter()
const editable = ref(false)
// Versions and Activity are the Runs page's other tabs, opened in a new tab as Runs is.
const openRunsTab = (hash) =>
  window.open(router.resolve({ name: 'Workflow Runs', params: { workflowId: props.workflowId }, hash }).href, '_blank')
const saving = ref(false)
const moving = ref(null)
const aborting = ref(false)

// `Draining` is the drain's own word for "a cohort is walking right now" — read off the workflow the page already loaded, never asked for separately.
const isDraining = computed(() => workflow.data?.cohort_state === 'Draining')

// The backend's verdict on the graph, `{node_id, field, message, severity}` rows; the header pill, the node badges and the inspector all read this one list.
const problems = ref([])
// Save, Publish and entering edit all land here, so every surface shows one answer.
function showVerdict(answer) {
  problems.value = answer?.problems || []
}

// The lifecycle, as the backend declares it; `revise` is deliberately absent because it and Edit were the same door under two names, so the ONE Edit verb owns that transition (see `editWorkflow`).
const LIFECYCLE = {
  Draft: [{ action: 'publish', label: 'Publish', icon: 'upload-cloud', confirm: 'Freeze this graph as a new version? It will not run until you activate it.' }],
  Published: [
    { action: 'activate', label: 'Activate', icon: 'play', confirm: 'Arm this workflow? From now on a matching event starts a journey.' },
  ],
  Active: [
    // `retires`: the verb KILLS, so the question names how many journeys die — a number only known once asked for, which is why these carry no plain `confirm` string. `confirmRetire` writes the message.
    { action: 'suspend', label: 'Suspend', icon: 'pause', retires: true },
  ],
  Suspended: [
    { action: 'activate', label: 'Activate', icon: 'play', confirm: 'Arm this workflow again?' },
    { action: 'archive', label: 'Archive', icon: 'archive', retires: true, confirm: 'This cannot be undone.' },
  ],
  Archived: [],
}

const transitions = computed(() =>
  editable.value ? [] : LIFECYCLE[workflow.data?.lifecycle_state || 'Draft'] || [],
)

// The overflow's two groups, which is how the divider between them is drawn: what moves the workflow forward, then what stops it — and a group with no verbs is absent rather than empty.
const lifecycleGroups = computed(() => {
  const item = (verb) => ({ label: __(verb.label), icon: verb.icon, onClick: () => confirmMove(verb) })
  const forward = transitions.value.filter((v) => !v.retires).map(item)
  const retiring = transitions.value.filter((v) => v.retires).map(item)
  // Rename and Duplicate work from every state, so a group of their own; not while editing, when the canvas is not yet saved.
  const copy = !editable.value && {
    group: __('Copy'),
    hideLabel: true,
    items: [
      { label: __('Rename'), icon: 'edit-2', onClick: () => (showRename.value = true) },
      { label: __('Duplicate'), icon: 'copy', onClick: () => (showDuplicate.value = true) },
    ],
  }
  return [
    forward.length && { group: __('Lifecycle'), hideLabel: true, items: forward },
    copy,
    retiring.length && { group: __('Stops the workflow'), items: retiring },
  ].filter(Boolean)
})

const showDuplicate = ref(false)
const showRename = ref(false)
const canvasRef = ref(null)
const canvasKey = ref(0)


async function save() {
  if (!canvasRef.value) return
  const graph = canvasRef.value.serialize()
  if (!graph) {
    // The editor never finished loading, so what is on screen is not this workflow. Saving here would persist an empty graph over a real one.
    toast.error(__('The editor has not finished loading. Reload before saving.'))
    return
  }
  const { nodes, canvas } = graph
  saving.value = true
  try {
    // Draft-only save: persists the graph + layout, mints no Version, arms nothing.
    const saved = await call('tatva_connect.workflows.api.save_draft', {
      name: props.workflowId,
      nodes: JSON.stringify(nodes),
      canvas_json: JSON.stringify(canvas),
    })
    markClean()
    // Save answers with what would block a Publish, so the canvas marks it now rather than at Publish.
    showVerdict(saved)
    toast.success(__('Draft saved'))
    // Stay in edit mode. Saving is a checkpoint, not a decision to stop working — dropping the author out of the editor after every save made them click Edit again to carry on, and lost the canvas selection each time. Leaving edit mode is what Cancel is for. The save ANSWERS with the document it just wrote, so the reload that used to follow was a second round trip for a payload already in hand — and it re-asked every graph question along with it.
    workflow.setData(saved)
  } catch (e) {
    const msgs = e?.messages?.length ? e.messages : [e?.message || __('Save failed')]
    msgs.forEach((m) => toast.error(m))
  } finally {
    saving.value = false
  }
}


// --- unsaved work is guarded, both ways out of the page --------------------------------------------- The canvas owns its own graph, so it owns the answer: dirty is DERIVED there from content + completed drags, never polled and never mirrored here. A second snapshot in this file would be a second opinion.
const dirtyNow = computed(() => canvasRef.value?.dirty ?? false)

function isDirty() {
  return dirtyNow.value
}

function markClean() {
  canvasRef.value?.markClean()
}

// Refresh, tab-close and in-app navigation all ask through the ONE guard every editing page shares.
const { confirmDiscard } = useUnsavedGuard({
  isDirty,
  message: __('This workflow has changes that have not been saved. They will be lost.'),
  forget: markClean,
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

// Retiring is KILLING, and the count is the difference between a mistake and an incident: "this will stop 3,140 journeys" is a decision, "suspend?" is a guess. Asked at CLICK time and not on the page (§A.4) — the number is only true at the moment of the question, and every other visitor would pay for it unread. One function for every retiring verb, driven by `verb.retires`, because Suspend and Archive now do the same thing to journeys and a second copy would drift the day one of them changed.
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
    // Deliberately not "everything stops": a message already handed to the provider has no job id to cancel by and will complete. Saying otherwise would be a promise the queue cannot keep.
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

// Stopping the FACTORY, not the journeys it already made — two different acts, so two different buttons and a message that says which one this is.
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
    // A graph that is not ready comes back as DATA: the nodes it names are marked on the canvas and the toast is the backend's one-line directive.
    if (result && result.ok === false) {
      showVerdict(result)
      toast.error(__("Can't publish yet. {0}", [result.summary]))
      return false
    }
    // A publish can succeed AND carry warnings (the engine is off), which the header pill keeps; a clean move carries none and clears it.
    showVerdict(result)
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
  showVerdict(null)
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
