<!-- TATVA: one Task Form — the builder for a single CRM Task Type, on the Workflows detail lifecycle. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="flex items-center gap-2">
        <Breadcrumbs
          :items="[
            { label: __('Task Forms'), route: { name: 'Task Forms' } },
            { label: title },
          ]"
        />
        <!-- The state HUGS the name, as the Workflows state does; editing hides it, as Workflows does. -->
        <Badge
          v-if="doc && !editable"
          :theme="lifecycleTheme(doc.lifecycle_state)"
          :label="__(doc.lifecycle_state || 'Draft')"
        />
      </div>
    </template>
    <template #right-header>
      <!-- The form's one verdict, the pill Workflows shows; a row takes the page to its question or rule. -->
      <ProblemsPill :problems="problems" anchorLabel="Question" :anchorName="anchorName" @focus="focusProblem" />
      <template v-if="editable">
        <span class="flex items-center gap-1 text-xs text-ink-gray-5">
          <FeatherIcon name="edit-2" class="h-3 w-3" />
          {{ editStatus }}
        </span>
        <Button
          :label="dirty ? __('Discard changes') : __('Close')"
          :disabled="saving"
          @click="cancel"
        />
        <Button
          variant="solid"
          :label="__('Save')"
          :disabled="!dirty || saving || duplicateKeys.size > 0"
          :loading="saving"
          @click="save"
        />
      </template>
      <template v-else-if="doc">
        <span class="hidden text-xs text-ink-gray-5 sm:inline">{{ grainLabel(doc) }}</span>
        <!-- The version reps are offered, as a workflow's header shows it; the detail lives inside the button. -->
        <Popover v-if="version">
          <template #target="{ togglePopover }">
            <Button variant="ghost" :label="`v${version.version_no}`" iconRight="chevron-down" @click="togglePopover()" />
          </template>
          <template #body-main>
            <div class="flex flex-col gap-1 p-3 text-xs text-ink-gray-6">
              <div>{{ __('{0} questions', [version.question_count]) }}</div>
              <div>{{ __('Frozen {0}', [formatListDate(version.created, true)]) }}</div>
              <div class="font-mono text-ink-gray-4">{{ version.hash }}</div>
            </div>
          </template>
        </Popover>
        <span v-else class="text-xs italic text-ink-gray-4">{{ __('never published') }}</span>
        <!-- What a rep is asked now, the served version — as Workflows offers Runs beside Edit. -->
        <Button :label="__('Preview')" @click="showPreview = true" />
        <!-- ONE primary verb, the same word in every state, as on a workflow. -->
        <Button
          v-if="form.data.can_write"
          variant="solid"
          :label="__('Edit')"
          :loading="moving === 'revise'"
          @click="editForm"
        />
        <!-- The lifecycle lives behind the overflow, as it does on a workflow; the server lists which moves are legal. -->
        <Dropdown v-if="form.data.can_write && lifecycleGroups.length" :options="lifecycleGroups">
          <Button variant="ghost" icon="more-horizontal" :tooltip="__('More')" />
        </Dropdown>
      </template>
    </template>
  </LayoutHeader>

  <div v-if="form.loading && !form.data" class="flex flex-1 items-center justify-center">
    <LoadingIndicator class="h-6 w-6 text-ink-gray-5" />
  </div>
  <div
    v-else-if="form.error"
    class="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-ink-gray-5"
  >
    <div>{{ form.error.messages?.[0] || form.error.message }}</div>
    <Button :label="__('Retry')" @click="form.reload()" />
  </div>
  <!-- The CRM record page: tabs on the left, the record's own details in the side panel on the right, as a lead's are. -->
  <div v-else-if="form.data" class="flex h-full overflow-hidden">
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- The server collapses a repeated key silently, so this is the one check the page makes before a save. -->
      <Alert
        v-if="duplicateKeys.size"
        class="mx-5 mt-3 shrink-0"
        theme="orange"
        :title="__('Two questions share a key: {0}', [[...duplicateKeys].join(', ')])"
      />
      <Tabs
        v-model="tabIndex"
        :tabs="tabs"
        class="flex flex-1 overflow-hidden flex-col [&_[role='tab']]:px-0 [&_[role='tab']]:shrink-0 [&_[role='tablist']]:px-5 [&_[role='tablist']::-webkit-scrollbar]:h-0 [&_[role='tablist']]:min-h-[45px] [&_[role='tablist']]:gap-7.5 [&_[role='tabpanel']:not([hidden])]:flex [&_[role='tabpanel']:not([hidden])]:grow [&_[role='tabpanel']]:overflow-hidden"
      >
        <template #tab-panel="{ tab }">
          <!-- The Activity rail carries its own gutters, as it does on a lead; every other tab takes the page padding. -->
          <div class="flex flex-1 flex-col overflow-y-auto" :class="{ 'p-5': !['activity', 'versions'].includes(tab.name) }">
            <ChangeHistory v-if="tab.name === 'activity'" doctype="CRM Task Type" :icon="TaskIcon" :name="formName" />
            <!-- Every version this form has frozen, newest first: the native list Workflows' Versions tab is, over CRM Task Type Version. -->
            <template v-else-if="tab.name === 'versions'">
              <ViewControls
                ref="versionControls"
                v-model="versions"
                v-model:loadMore="versionsLoadMore"
                v-model:resizeColumn="versionsResize"
                v-model:updatedPageCount="versionsPageCount"
                doctype="CRM Task Type Version"
                :filters="{ task_type: formName }"
                :options="{ defaultViewName: 'Versions' }"
              />
              <WorkflowRunsListView
                v-if="versions.data && versionRows.length"
                v-model="versions.data.page_length_count"
                v-model:list="versions"
                doctype="CRM Task Type Version"
                :rows="versionRows"
                :columns="versionColumns"
                :options="{
                  showTooltip: false,
                  resizeColumn: true,
                  rowCount: versions.data.row_count,
                  totalCount: versions.data.total_count,
                }"
                @loadMore="() => versionsLoadMore++"
                @columnWidthUpdated="() => versionsResize++"
                @updatePageCount="(count) => (versionsPageCount = count)"
                @applyFilter="(data) => versionControls.applyFilter(data)"
                @applyLikeFilter="(data) => versionControls.applyLikeFilter(data)"
                @likeDoc="(data) => versionControls.likeDoc(data)"
                @selectionsChanged="(selections) => versionControls.updateSelections(selections)"
              />
              <EmptyState
                v-else-if="versions.data && !versionRows.length"
                name="Versions"
                :icon="LucideGitBranch"
                :title="__('No version to show')"
                :description="__('A version is frozen each time this form is published, and every task is read with the one it was answered on.')"
              />
            </template>
            <!-- How the form is used, as Workflow Runs shows a workflow's runs; every tile drills into the native Tasks list. -->
            <template v-else-if="tab.name === 'submissions'">
              <div v-if="counts.loading && !counts.data" class="flex h-full items-center justify-center">
                <LoadingIndicator class="h-6 w-6 text-ink-gray-5" />
              </div>
              <!-- The Dashboard's own grid and tiles, placed on its 12-column grid exactly as a dashboard layout places them. -->
              <DashboardGrid v-else-if="counts.data" :charts="tiles" @drill="openDrill" />
            </template>
            <!-- The house empty state for a form that asks nothing yet; Edit is where questions are added. -->
            <EmptyState
              v-else-if="tab.name === 'design' && !editable && !doc.schema.length"
              name="Questions"
              :title="__('No Questions Added Yet')"
              :description="__('Click Edit to add sections and questions.')"
              :icon="LucideClipboardList"
            />
            <!-- ONE layout: frozen while viewing, the same one unlocked by Edit; how the form behaves is Preview's job. -->
            <FieldLayoutEditor
              v-else-if="tab.name === 'design'"
              :modelValue="editable ? draft.tree : layout"
              doctype="CRM Task Type"
              :fields="palette"
              :makeField="makeField"
              :selected="selected"
              :readonly="!editable || saving"
              @select="select"
            />
            <FormRules
              v-else
              v-model:cards="cards"
              :rows="editable ? flattenLayout(draft.tree) : doc.schema"
              :targets="form.data.targets"
              :options="form.data.rule_options"
              :editable="editable && !saving"
            />
          </div>
        </template>
      </Tabs>
    </div>
    <Resizer class="flex flex-col border-l" side="right">
      <div
        class="flex h-[45px] items-center justify-between border-b px-5 py-2.5 text-lg font-medium text-ink-gray-9"
      >
        {{ selected ? __('Question') : __('Settings') }}
        <Button v-if="selected" variant="ghost" icon="x" :tooltip="__('Back to settings')" @click="selected = null" />
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        <FieldInspector
          v-if="selected"
          :key="selectedKey"
          v-model:row="selected"
          :editable="editable && !saving"
          :types="form.data.question_types"
          :leadFields="form.data.lead_fields"
          :bindings="form.data.bindings"
          :duplicate="duplicateKeys.has(selected.fieldname)"
          :problems="selectedProblems"
        />
        <div v-else class="flex flex-col gap-3">
          <!-- `context` is the standalone mode: FieldLayout renders `data` and fetches no document of its own. -->
          <FieldLayout
            :key="editable ? 'edit' : 'view'"
            :tabs="settings"
            :data="editable ? draft.doc : doc"
            doctype="CRM Task Type"
            :context="{}"
          />
          <!-- A select cannot offer a blank choice, so removing the location rule is its own control. -->
          <Button
            v-if="editable && draft.doc.location_condition_field"
            class="self-start"
            variant="ghost"
            :label="__('Remove the location rule')"
            @click="clearLocation"
          />
        </div>
      </div>
    </Resizer>
  </div>
  <TaskModal
    v-if="showPreview"
    v-model="showPreview"
    mode="create"
    :defaultType="doc.name"
    preview
  />
  <FormDialog v-if="showDuplicate" v-model="showDuplicate" :source="doc" />
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import Resizer from '@/components/Resizer.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import LucideClipboardList from '~icons/lucide/clipboard-list'
import FieldLayoutEditor from '@/components/FieldLayoutEditor.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import FormRules from './FormRules.vue'
import FieldInspector from './FieldInspector.vue'
import FormDialog from './FormDialog.vue'
import DashboardGrid from '@/components/Dashboard/DashboardGrid.vue'
import TaskModal from '@/tatva/TaskModal.vue'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import DetailsIcon from '@/components/Icons/DetailsIcon.vue'
import LightningIcon from '@/components/Icons/LightningIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import ChangeHistory from '@/tatva/ChangeHistory.vue'
import ViewControls from '@/components/ViewControls.vue'
import WorkflowRunsListView from '@/tatva/workflows/WorkflowRunsListView.vue'
import LucideGitBranch from '~icons/lucide/git-branch'
import { listColumns, listRows } from '@/tatva/viewList'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import { isQuestion, choicesOf, newKey } from './formVocabulary'
import { formatListDate } from '@/utils'
import { bindLayout, flattenLayout } from './layoutTree'
import { toCards, flattenCards } from './ruleCards'
import { grainLabel } from '@/tatva/useEntitledGrains'
import { createDialog } from '@/utils/dialogs'
import { useUnsavedGuard } from '@/tatva/useUnsavedGuard'
import { REVISE, useLifecycle } from '@/tatva/useLifecycle'
import { lifecycleTheme } from '@/tatva/workflows/journeyStatus'
import ProblemsPill from '@/tatva/workflows/ProblemsPill.vue'
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Dropdown,
  FeatherIcon,
  LoadingIndicator,
  Popover,
  Tabs,
  call,
  createResource,
  toast,
  usePageMeta,
} from 'frappe-ui'
import { getSettings } from '@/stores/settings'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({ formName: { type: String, required: true } })
const router = useRouter()
// Every builder verb is a method of the form's own controller module.
const BUILDER = 'tatva_connect.taxonomy.doctype.crm_task_type.crm_task_type'

// One call for the whole page and no cache key: two authors on one form must never open a stale copy.
const form = createResource({
  url: `${BUILDER}.builder_doc`,
  makeParams: () => ({ task_type: props.formName }),
  auto: true,
})

const doc = computed(() => form.data?.doc)
const title = computed(() => doc.value?.type_name || props.formName)
const { brand } = getSettings()
const layout = computed(() => bindLayout(form.data.layout, doc.value.schema))
const viewCards = computed(() => toCards(doc.value.rules))
// The Rules tab edits the draft's cards and reads the saved ones; one binding for both.
const cards = computed({
  get: () => (editable.value ? draft.value.cards : viewCards.value),
  set: (value) => (draft.value.cards = value),
})

// Settings: read-only in view; editing locks the NAME fields (Duplicate renames) and offers the location rule this form's own questions.
const settings = computed(() => {
  const data = editable.value ? draft.value.doc : doc.value
  const rows = editable.value ? flattenLayout(draft.value.tree) : doc.value.schema
  const questions = rows.filter(isQuestion)
  const choices = choicesOf(questions.find((r) => r.fieldname === data.location_condition_field))
  const shape = (f) => {
    const locked = !editable.value || form.data.name_fields.includes(f.fieldname)
    const own = {
      location_condition_field: {
        options: [{ label: '', value: '' }, ...questions.map((q) => ({ label: q.label || q.fieldname, value: q.fieldname }))],
      },
      location_condition_value: choices.length
        ? { options: [{ label: '', value: '' }, ...choices.map((c) => ({ label: c, value: c }))] }
        : { fieldtype: 'Data', options: '' },
    }[f.fieldname]
    return { ...f, ...own, read_only: locked ? 1 : f.read_only }
  }
  return form.data.settings.map((tab) => ({
    ...tab,
    sections: tab.sections.map((section) => ({
      ...section,
      columns: (section.columns || []).map((column) => ({ ...column, fields: column.fields.map(shape) })),
    })),
  }))
})

function clearLocation() {
  for (const key of ['location_condition_field', 'location_operator', 'location_condition_value']) draft.value.doc[key] = ''
}

const showPreview = ref(false)
const showDuplicate = ref(false)

const version = computed(() => form.data?.version || null)
const isDraft = computed(() => (doc.value?.lifecycle_state || 'Draft') === 'Draft')

// The server's verdict, `{node_id, field, message, fix}` rows; the header pill, the question panel and Publish all read this one list.
const problems = ref([])
function showVerdict(answer) {
  problems.value = answer?.problems || []
}
// The open question's own problems, for its panel; recomputed only when the verdict or the selection changes.
const selectedProblems = computed(() => problems.value.filter((p) => p.node_id === selected.value?.fieldname))

// What each verb says before it moves the form; which verbs are legal is the server's (`moves`), and Revise is Edit's own door.
const VERBS = {
  publish: { action: 'publish', label: 'Publish', icon: 'upload-cloud', confirm: 'Freeze this form as a new version? If reps already have it, they get this version from their next open.' },
  activate: { action: 'activate', label: 'Activate', icon: 'play', confirm: 'Offer this form to reps? They see it from their next open.' },
  suspend: { action: 'suspend', label: 'Suspend', icon: 'pause', retires: true, confirm: 'Stop offering this form to reps? Everything it recorded stays readable.' },
  archive: { action: 'archive', label: 'Archive', icon: 'archive', retires: true, confirm: 'Retire this form for good? Everything it recorded stays readable. This cannot be undone.' },
}
const transitions = computed(() => (editable.value ? [] : (form.data?.moves || []).map((m) => VERBS[m.verb]).filter(Boolean)))

const { moving, groups, edit } = useLifecycle({
  method: (action) => `${BUILDER}.${action}`,
  name: () => props.formName,
  reload: () => form.reload(),
  showVerdict,
})

// Duplicate works from every state, so a group of its own, as on a workflow; it is how a form gets another name or grain.
const lifecycleGroups = computed(() =>
  groups(
    transitions.value,
    { group: __('Copy'), hideLabel: true, items: [{ label: __('Duplicate'), icon: 'copy', onClick: () => (showDuplicate.value = true) }] },
    __('Stops the form'),
  ),
)

// ONE door into the editor, the Workflows one: a Draft opens; a released form goes back to Draft, and reps keep its published version meanwhile.
function editForm() {
  edit({
    isDraft: isDraft.value,
    title: __('Edit this form'),
    message: __('Editing makes a Draft. Reps keep the published version until you publish again.'),
    revise: REVISE,
    start: startEdit,
  })
}

const tabs = computed(() => [
  { name: 'design', label: __('Design'), icon: DetailsIcon },
  { name: 'rules', label: __('Rules'), icon: LightningIcon },
  { name: 'submissions', label: __('Submissions'), icon: TaskIcon },
  { name: 'versions', label: __('Versions'), icon: LucideGitBranch },
  { name: 'activity', label: __('Activity'), icon: ActivityIcon },
])
// The tab lives in the URL hash and the last one is remembered, as on a lead.
const { tabIndex } = useActiveTabManager(tabs, 'lastTaskFormTab', 'design')
// The browser tab names the record, as a lead's page does; read again on every tab change, as the Versions list's own title outlives its tab.
usePageMeta(() => ({ title: title.value, icon: brand.favicon, tab: tabIndex.value }))

// The Submissions counts are asked the first time that tab opens, never with the page: most visits never look.
const counts = createResource({
  url: `${BUILDER}.submission_counts`,
  makeParams: () => ({ task_type: props.formName }),
})
watch(
  tabIndex,
  (i) => {
    if (tabs.value[i]?.name === 'submissions' && !counts.data && !counts.loading) counts.fetch()
  },
  { immediate: true },
)
// The split (6x6, left) and the six due-state tiles two by three beside it (3x2 each): the dashboard's own sizes on its own grid.
const tiles = computed(() => [
  {
    chart: 'split',
    type: 'donut',
    label: __('Logged · {0}', [counts.data.total]),
    subtitle: counts.data.last_logged_at
      ? __('Last logged {0}', [formatListDate(counts.data.last_logged_at, true)])
      : __('Never logged'),
    points: counts.data.buckets
      .filter((b) => b.total)
      .map((b) => ({ label: __(b.bucket), raw: b.bucket, value: b.total, drill: b.drill })),
    x: 0,
    y: 0,
    w: 6,
    h: 6,
  },
  ...counts.data.buckets.map((b, i) => ({
    chart: b.bucket,
    type: 'number',
    label: __(b.bucket),
    value: b.total,
    drill: b.drill,
    x: 6 + (i % 2) * 3,
    y: Math.floor(i / 2) * 2,
    w: 3,
    h: 2,
  })),
])
// A slice opens its list in a new tab, as a card does, so the form stays open behind it.
const openDrill = (drill) => window.open(router.resolve(drillRoute(drill)).href, '_blank')
// The dashboard's drill: the list route and filters come from the server; the list is pinned to its list view.
const drillRoute = (drill) => ({
  name: drill.route,
  params: { viewType: 'list' },
  query: { filters: JSON.stringify(drill.filters) },
})

// The versions list, loaded by its own ViewControls when its tab opens, exactly as a workflow's is.
const versions = ref({})
const versionsLoadMore = ref(1)
const versionsResize = ref(1)
const versionsPageCount = ref(20)
const versionControls = ref(null)
const versionRows = computed(() => listRows(versions.value))
const versionColumns = computed(() => listColumns(versions.value))

// --- edit: a DRAFT copy of the loaded form; the loaded one stays what the server holds ---------------
const editable = ref(false)
const saving = ref(false)
const draft = ref(null)
const baseline = ref('')

// Edit mode says whether the work is committed, as Workflows does, and which version reps keep meanwhile.
const editStatus = computed(() => {
  const status = dirty.value ? __('Editing draft — unsaved changes') : __('Editing draft — all changes saved')
  return doc.value?.enabled && version.value ? `${status} · ${__('reps keep v{0}', [version.value.version_no])}` : status
})

// The whole doc as the server returned it (`modified` included), with the layout written back as rows.
const payload = () => ({
  ...draft.value.doc,
  schema: flattenLayout(draft.value.tree),
  rules: flattenCards(draft.value.cards),
})
const dirty = computed(() => editable.value && JSON.stringify(payload()) !== baseline.value)

// --- questions: pick one to read or change it; add one from the picker -------------------------------
const selected = ref(null)
const selectedKey = ref(0)
function select(field) {
  selected.value = field
  selectedKey.value++
}

// The Add Field list: the child doctype's own Field Types, in Desk's words; what a field is bound to is chosen in its panel.
const palette = computed(() =>
  editable.value
    ? form.data.question_types.map((t) => ({ label: __(t), fieldname: t, fieldtype: t }))
    : [],
)

// A picked type becomes a new question row (no `name` — the save creates it), a new answer until bound, open in the panel.
function makeField(option) {
  const node = reactive({
    label: option.label,
    fieldname: newKey(option.label),
    fieldtype: option.fieldtype,
    source: 'Activity',
  })
  select(node)
  return node
}

// Keys used twice in what a save would write — layout rows included, since every row needs its own.
const duplicateKeys = computed(() => {
  if (!editable.value) return new Set()
  const seen = new Set()
  const twice = new Set()
  for (const r of flattenLayout(draft.value.tree)) (seen.has(r.fieldname) ? twice : seen).add(r.fieldname)
  return twice
})

function startEdit() {
  // The question open in the panel stays open across a save, found again by its key.
  const keep = selected.value?.fieldname
  selected.value = null
  // Reactive, so a rename written through a node's label setter onto its row is seen by `dirty`.
  const copy = reactive(JSON.parse(JSON.stringify(form.data.doc)))
  // Rules are grouped into cards ONCE, here: regrouping while editing could merge two rules mid-keystroke.
  draft.value = { doc: copy, tree: bindLayout(form.data.layout, copy.schema), cards: toCards(copy.rules) }
  baseline.value = JSON.stringify(payload())
  editable.value = true
  const again = keep && fieldsOf(draft.value.tree).find((f) => f.fieldname === keep)
  if (again) select(again)
}

function stopEdit() {
  selected.value = null
  editable.value = false
  draft.value = null
  showVerdict(null)
}

function cancel() {
  if (dirty.value) confirmDiscard(stopEdit)
  else stopEdit()
}

// Every question a layout holds, in order; the problems list and a kept selection find a question here by its key.
const fieldsOf = (tree) => tree.flatMap((t) => t.sections.flatMap((s) => s.columns.flatMap((c) => c.fields)))

// A problem's anchor as the pill reads it: a question by its label, a rule by its row, as the server addressed it.
const questionLabels = computed(() => {
  const rows = editable.value ? flattenLayout(draft.value.tree) : doc.value?.schema || []
  return new Map(rows.map((r) => [r.fieldname, r.label || r.fieldname]))
})
const anchorName = (id) => (id.startsWith('rule:') ? __('Rule row {0}', [id.slice(5)]) : questionLabels.value.get(id) || id)

// A pill row takes the page where the fault is: a rule to the Rules tab, a question to the Design tab with its panel open.
function focusProblem(id) {
  if (id.startsWith('rule:')) return (tabIndex.value = tabs.value.findIndex((t) => t.name === 'rules'))
  tabIndex.value = tabs.value.findIndex((t) => t.name === 'design')
  const field = fieldsOf(editable.value ? draft.value.tree : layout.value).find((f) => f.fieldname === id)
  if (field) select(field)
}

// Save = Workflows' Draft save: nothing a rep sees changes, so it asks nothing; the server answers with what would block a Publish.
async function save() {
  saving.value = true
  try {
    const answer = await call(`${BUILDER}.save_draft`, { doc: payload() })
    showVerdict(answer)
    if (!answer.saved) {
      toast.error(__('Not saved yet. {0}', [answer.summary]))
      return
    }
    // The save ANSWERS with the form as stored, so no reload follows; editing carries on from it.
    form.setData(answer)
    startEdit()
    toast.success(__('Draft saved'))
  } catch (e) {
    if (e?.exc_type === 'TimestampMismatchError') return confirmConflict()
    if (e?.exc_type === 'PermissionError') {
      toast.error(e.messages?.[0] || __('Not permitted'))
      stopEdit()
      return form.reload()
    }
    const msgs = e?.messages?.length ? e.messages : [e?.message || __('Save failed')]
    msgs.forEach((m) => toast.error(m))
  } finally {
    saving.value = false
  }
}

// Someone saved after this draft was opened; never auto-merge.
function confirmConflict() {
  createDialog({
    title: __('Someone saved this form after you opened it'),
    message: __('Reload to see their version (your changes are dropped), or keep editing.'),
    actions: [
      {
        label: __('Reload'),
        variant: 'solid',
        onClick: async (close) => {
          close()
          stopEdit()
          await form.reload()
        },
      },
      { label: __('Keep editing'), onClick: (close) => close() },
    ],
  })
}

// --- unsaved work is guarded both ways out of the page, by the ONE guard Workflows uses too ------------
const { confirmDiscard } = useUnsavedGuard({
  isDirty: () => dirty.value,
  message: __('This form has changes that have not been saved. They will be lost.'),
  forget: stopEdit,
})
</script>
