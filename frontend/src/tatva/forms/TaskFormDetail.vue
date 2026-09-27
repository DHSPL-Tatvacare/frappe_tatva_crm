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
          variant="subtle"
          :theme="doc.enabled ? 'green' : 'gray'"
          :label="doc.enabled ? __('Enabled') : __('Disabled')"
        />
      </div>
    </template>
    <template #right-header>
      <template v-if="editable">
        <span class="flex items-center gap-1 text-xs text-ink-gray-5">
          <FeatherIcon name="edit-2" class="h-3 w-3" />
          {{ dirty ? __('Editing — unsaved changes') : __('Editing — all changes saved') }}
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
        <!-- The rep's own form, as saved — as Workflows offers Runs beside Edit. -->
        <Button :label="__('Preview')" @click="showPreview = true" />
        <Button
          v-if="form.data.can_write"
          variant="solid"
          :label="__('Edit')"
          @click="startEdit"
        />
        <!-- The lifecycle lives behind the overflow, as it does on a workflow. -->
        <Dropdown v-if="form.data.can_write" :options="lifecycle">
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
      <!-- The server is the only judge of a save; its refusal is shown as it said it. -->
      <!-- The Workflows publish banner's shape: the server's own refusal, and a way to where it points. -->
      <Alert v-if="saveError" class="mx-5 mt-3 shrink-0" theme="red" :title="__('This form cannot be saved yet')">
        <template #description>
          <div class="flex items-start gap-3">
            <span class="whitespace-pre-line text-ink-gray-7">{{ saveError }}</span>
            <Button
              v-if="saveErrorTarget"
              variant="solid"
              class="ml-auto shrink-0"
              :label="saveErrorTarget.label"
              @click="goToError"
            />
          </div>
        </template>
      </Alert>
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
          <div class="flex flex-1 flex-col overflow-y-auto" :class="{ 'p-5': tab.name !== 'activity' }">
            <ChangeHistory v-if="tab.name === 'activity'" doctype="CRM Task Type" :icon="TaskIcon" :name="formName" />
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
          :duplicate="duplicateKeys.has(selected.fieldname)"
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
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import { isQuestion, choicesOf } from './formVocabulary'
import { formatListDate, getRandom } from '@/utils'
import { scrub } from '@/tatva/scrub'
import { bindLayout, flattenLayout } from './layoutTree'
import { toCards, flattenCards } from './ruleCards'
import { grainLabel } from '@/tatva/useEntitledGrains'
import { createDialog } from '@/utils/dialogs'
import { useUnsavedGuard } from '@/tatva/useUnsavedGuard'
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Dropdown,
  FeatherIcon,
  LoadingIndicator,
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

// One call for the whole page and no cache key: two authors on one form must never open a stale copy.
const form = createResource({
  url: 'tatva_connect.taxonomy.doctype.crm_task_type.crm_task_type.builder_doc',
  makeParams: () => ({ task_type: props.formName }),
  auto: true,
})

const doc = computed(() => form.data?.doc)
const title = computed(() => doc.value?.type_name || props.formName)
const { brand } = getSettings()
// The browser tab names the record, as a lead's page does.
usePageMeta(() => ({ title: title.value, icon: brand.favicon }))
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

// Enable/Disable is the form's lifecycle verb, asked first as a workflow's is; Duplicate is how a form gets another name or grain.
const lifecycle = computed(() => [
  {
    group: __('Lifecycle'),
    hideLabel: true,
    items: [
      { label: doc.value?.enabled ? __('Disable') : __('Enable'), onClick: confirmEnabled },
      { label: __('Duplicate'), onClick: () => (showDuplicate.value = true) },
    ],
  },
])
function confirmEnabled() {
  const on = !doc.value.enabled
  createDialog({
    title: on ? __('Enable this form?') : __('Disable this form?'),
    message: on
      ? __('Reps are offered it from their next open.')
      : __('Reps stop being offered it. Everything it already recorded stays readable.'),
    actions: [
      {
        label: on ? __('Enable') : __('Disable'),
        variant: 'solid',
        onClick: async (close) => {
          close()
          try {
            await call('frappe.client.save', { doc: { ...form.data.doc, enabled: on ? 1 : 0 } })
            await form.reload()
            toast.success(on ? __('Enabled') : __('Disabled'))
          } catch (e) {
            if (e?.exc_type === 'TimestampMismatchError') return confirmConflict()
            toast.error((e?.messages?.length ? e.messages : [e?.message || __('Not saved')]).join(' '))
          }
        },
      },
    ],
  })
}

const tabs = computed(() => [
  { name: 'design', label: __('Design'), icon: DetailsIcon },
  { name: 'rules', label: __('Rules'), icon: LightningIcon },
  { name: 'submissions', label: __('Submissions'), icon: TaskIcon },
  { name: 'activity', label: __('Activity'), icon: ActivityIcon },
])
// The tab lives in the URL hash and the last one is remembered, as on a lead.
const { tabIndex } = useActiveTabManager(tabs, 'lastTaskFormTab', 'design')

// The Submissions counts are asked the first time that tab opens, never with the page: most visits never look.
const counts = createResource({
  url: 'tatva_connect.taxonomy.doctype.crm_task_type.crm_task_type.submission_counts',
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

// --- edit: a DRAFT copy of the loaded form; the loaded one stays what the server holds ---------------
const editable = ref(false)
const saving = ref(false)
const saveError = ref('')
const draft = ref(null)
const baseline = ref('')

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

// Every question type the child doctype declares, then every lead field this grain offers — the Add Field list.
const palette = computed(() =>
  editable.value
    ? [
        // The question types in Desk's own Field Type words; a type the doctype adds appears here with no code.
        {
          group: __('Field Type'),
          items: form.data.question_types.map((t) => ({ label: __(t), fieldname: `new_${scrub(t)}`, fieldtype: t })),
        },
        {
          group: __('From Lead'),
          items: form.data.lead_fields.map((f) => ({ ...f, fieldtype: storedType(f) })),
        },
      ]
    : [],
)
const leadField = computed(() => new Map(form.data.lead_fields.map((f) => [f.fieldname, f])))

// A picked entry becomes a real new question row (no `name` — the save creates it) and opens in the panel.
// A lead field whose type a question cannot take is asked as Text.
const storedType = (f) => (form.data.question_types.includes(f.fieldtype) ? f.fieldtype : 'Data')
function makeField(option) {
  const lead = leadField.value.get(option.fieldname)
  const row = lead
    ? { label: lead.label, fieldname: lead.fieldname, fieldtype: storedType(lead), source: 'Lead' }
    : { label: option.label, fieldname: `${scrub(option.label)}_${getRandom().toLowerCase()}`, fieldtype: option.fieldtype, source: 'Activity' }
  const node = reactive(row)
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
  selected.value = null
  // Reactive, so a rename written through a node's label setter onto its row is seen by `dirty`.
  const copy = reactive(JSON.parse(JSON.stringify(form.data.doc)))
  // Rules are grouped into cards ONCE, here: regrouping while editing could merge two rules mid-keystroke.
  draft.value = { doc: copy, tree: bindLayout(form.data.layout, copy.schema), cards: toCards(copy.rules) }
  baseline.value = JSON.stringify(payload())
  saveError.value = ''
  editable.value = true
}

function stopEdit() {
  selected.value = null
  editable.value = false
  draft.value = null
  saveError.value = ''
}

function cancel() {
  if (dirty.value) confirmDiscard(stopEdit)
  else stopEdit()
}

// Questions this save would drop: a child row left out of a save is DELETED, so the author is told which.
const removedQuestions = () => {
  const kept = new Set(flattenLayout(draft.value.tree).map((r) => r.name))
  return form.data.doc.schema.filter((r) => !kept.has(r.name) && isQuestion(r))
}

// The server's refusal names a row ("Rule row 3", "Schema row 7"); the banner offers the way there, never a verdict of its own.
const saveErrorTarget = computed(() => {
  const m = /^(Rule|Schema) row (\d+)/.exec(saveError.value)
  if (!m) return null
  return { kind: m[1], idx: Number(m[2]), label: m[1] === 'Rule' ? __('Go to rule') : __('Go to question') }
})
function goToError() {
  const { kind, idx } = saveErrorTarget.value
  if (kind === 'Rule') return (tabIndex.value = 1)
  tabIndex.value = 0
  const row = flattenLayout(draft.value.tree)[idx - 1]
  const fields = draft.value.tree.flatMap((t) => t.sections.flatMap((s) => s.columns.flatMap((c) => c.fields)))
  const field = row && fields.find((f) => f.fieldname === row.fieldname)
  if (field) select(field)
}

// Save = Workflows' publish order: the server checks the draft first (its own save, stopped before writing), then the author confirms, then it saves.
async function save() {
  saving.value = true
  saveError.value = ''
  let refusal
  try {
    refusal = await call('tatva_connect.taxonomy.doctype.crm_task_type.crm_task_type.check_draft', { doc: payload() })
  } catch (e) {
    refusal = { message: (e?.messages?.length ? e.messages : [e?.message || __('Could not check the form')]).join('\n') }
  } finally {
    saving.value = false
  }
  if (refusal?.exc_type === 'TimestampMismatchError') return confirmConflict()
  if (refusal) return (saveError.value = refusal.message.replace(/<br\s*\/?>/g, '\n'))
  confirmSave()
}

// The form is live, so every save asks; a save that removes questions says which, in the warning colour.
function confirmSave() {
  const removed = removedQuestions()
  createDialog({
    title: __('Save to the live form?'),
    icon: removed.length
      ? { name: 'alert-triangle', appearance: 'warning' }
      : { name: 'upload-cloud', appearance: 'info' },
    message: removed.length
      ? __('Reps see the change on their next open. {0} will be removed; answers already recorded stay stored but are no longer shown.', [
          removed.map((r) => r.label || r.fieldname).join(', '),
        ])
      : __('Every check passed. Reps see the change the next time they open this form.'),
    actions: [
      {
        label: removed.length ? __('Save and remove') : __('Save'),
        variant: 'solid',
        theme: removed.length ? 'red' : 'gray',
        onClick: (close) => {
          close()
          return persist()
        },
      },
    ],
  })
}

async function persist() {
  saving.value = true
  saveError.value = ''
  try {
    await call('frappe.client.save', { doc: payload() })
    // Stay in edit mode, as Workflows does: a save is a checkpoint, not a decision to stop working.
    await form.reload()
    startEdit()
    toast.success(__('Saved'))
  } catch (e) {
    if (e?.exc_type === 'TimestampMismatchError') return confirmConflict()
    if (e?.exc_type === 'PermissionError') {
      toast.error(e.messages?.[0] || __('Not permitted'))
      stopEdit()
      return form.reload()
    }
    saveError.value = (e?.messages?.length ? e.messages : [e?.message || __('Save failed')]).join('\n')
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
