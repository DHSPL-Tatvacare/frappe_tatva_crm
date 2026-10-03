<!-- TATVA: one workflow's run history, as a PAGE — because everything the run list was missing (a column manager, remembered widths, sort, saved views) is `CRM View Settings`, and that is a per-user record keyed to a doctype and a route. A modal has no route, so it could never have had any of it. Nothing here is new machinery: `ViewControls` is the same toolbar `Leads.vue` mounts, the rows come from the same `crm.api.doc.get_data`, and the list is pinned to this workflow by `default_filters`, which is native's own way of saying a list is always about one thing. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs
        v-model="viewControls"
        routeName="Workflows"
        :items="[
          { label: title, route: { name: 'Workflow', params: { workflowId } } },
        ]"
      />
    </template>
    <template #right-header>
      <!-- Whose business line these runs belong to, in the header and not as columns: a journey stores no grain of its own, and every row on this page is the SAME workflow, so three columns would repeat one value down the whole list. Same sentence the canvas header carries, from the one labeller. -->
      <span class="hidden text-xs text-ink-gray-5 sm:inline">{{
        subtitle
      }}</span>
      <CustomActions
        v-if="runsListView?.customListActions"
        :actions="runsListView.customListActions"
      />
    </template>
  </LayoutHeader>
  <!-- Three tabs, as a record page has them: the runs, the frozen versions they run on, and the workflow's Activity — who changed it and what went live. -->
  <Tabs
    v-model="tabIndex"
    :tabs="tabs"
    class="flex flex-1 overflow-hidden flex-col [&_[role='tab']]:px-0 [&_[role='tab']]:shrink-0 [&_[role='tablist']]:px-5 [&_[role='tablist']::-webkit-scrollbar]:h-0 [&_[role='tablist']]:min-h-[45px] [&_[role='tablist']]:gap-7.5 [&_[role='tabpanel']:not([hidden])]:flex [&_[role='tabpanel']:not([hidden])]:grow [&_[role='tabpanel']]:overflow-hidden"
  >
    <template #tab-panel="{ tab }">
      <div v-if="tab.name === 'activity'" class="flex flex-1 flex-col overflow-y-auto">
        <ChangeHistory doctype="CRM Workflow" :name="workflowId" :icon="LucideWorkflow" />
      </div>
      <!-- Every graph this workflow has frozen, newest first: the same native list as the runs, over CRM Workflow Version. -->
      <div v-else-if="tab.name === 'versions'" class="flex flex-1 flex-col overflow-hidden">
        <ViewControls
          ref="versionControls"
          v-model="versions"
          v-model:loadMore="versionsLoadMore"
          v-model:resizeColumn="versionsResize"
          v-model:updatedPageCount="versionsPageCount"
          doctype="CRM Workflow Version"
          :filters="{ workflow: workflowId }"
          :options="{ defaultViewName: 'Versions' }"
        />
        <WorkflowRunsListView
          v-if="versions.data && versionRows.length"
          v-model="versions.data.page_length_count"
          v-model:list="versions"
          doctype="CRM Workflow Version"
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
          @selectionsChanged="
            (selections) => versionControls.updateSelections(selections)
          "
        />
        <EmptyState
          v-else-if="versions.data && !versionRows.length"
          name="Versions"
          :icon="LucideWorkflow"
          :title="__('No version to show')"
          :description="
            __(
              'A version is frozen each time this workflow is published, and every journey runs on the one it started with.',
            )
          "
        />
      </div>
      <div v-else class="flex flex-1 flex-col overflow-hidden">
        <!-- How this workflow's runs stand, whole-workflow and unfiltered: the Dashboard's own NumberChart card (DashboardItem.vue), one per status the Journey declares. -->
        <div
          v-if="counts.data"
          class="grid grid-cols-2 gap-3 px-3 pt-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-6"
        >
          <div
            v-for="card in cards"
            :key="card.title"
            class="overflow-hidden rounded-md bg-surface-white shadow"
          >
            <NumberChart class="!items-start" :config="card">
              <template #delta>
                <span class="truncate text-xs text-ink-gray-5">{{
                  card.subtitle
                }}</span>
              </template>
            </NumberChart>
          </div>
        </div>
        <ViewControls
          ref="viewControls"
          v-model="runs"
          v-model:loadMore="loadMore"
          v-model:resizeColumn="triggerResize"
          v-model:updatedPageCount="updatedPageCount"
          doctype="CRM Workflow Journey"
          :filters="{ workflow: workflowId }"
          :options="{ defaultViewName: 'Runs' }"
        />
        <WorkflowRunsListView
          v-if="runs.data && rows.length"
          ref="runsListView"
          v-model="runs.data.page_length_count"
          v-model:list="runs"
          :rows="rows"
          :columns="columns"
          :options="{
            showTooltip: false,
            resizeColumn: true,
            rowCount: runs.data.row_count,
            totalCount: runs.data.total_count,
          }"
          @loadMore="() => loadMore++"
          @columnWidthUpdated="() => triggerResize++"
          @updatePageCount="(count) => (updatedPageCount = count)"
          @applyFilter="(data) => viewControls.applyFilter(data)"
          @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
          @likeDoc="(data) => viewControls.likeDoc(data)"
          @selectionsChanged="
            (selections) => viewControls.updateSelections(selections)
          "
          @showRun="(journey) => run.submit({ journey })"
        />
        <EmptyState
          v-else-if="runs.data && !rows.length"
          name="Runs"
          :icon="LucideWorkflow"
          :title="__('No run to show')"
          :description="
            __(
              'Every journey this workflow starts is recorded here — who it was for, where it got to, and why it stopped.',
            )
          "
        />
      </div>
    </template>
  </Tabs>
  <!-- The same run modal the lead's Workflow tab opens, keyed by the run so each one owns its step fetch. -->
  <WorkflowRunModal
    v-if="run.data"
    :key="run.data.journey"
    :journey="run.data"
    :modelValue="true"
    @update:modelValue="run.reset()"
  />
</template>
<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import ViewControls from '@/components/ViewControls.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import WorkflowRunsListView from './WorkflowRunsListView.vue'
import WorkflowRunModal from './WorkflowRunModal.vue'
import { workflowSubtitle } from './workflowLabels'
import LucideWorkflow from '~icons/lucide/workflow'
import LucideGitBranch from '~icons/lucide/git-branch'
import { formatListDate } from '@/utils'
import { listColumns, listRows } from '@/tatva/viewList'
import { LENS_CACHE_GENERATION } from '@/tatva/lensCache'
import { NumberChart, Tabs, createResource } from 'frappe-ui'
import ActivityIcon from '@/components/Icons/ActivityIcon.vue'
import ChangeHistory from '@/tatva/ChangeHistory.vue'
import { useActiveTabManager } from '@/composables/useActiveTabManager'
import { ref, computed } from 'vue'

const props = defineProps({
  workflowId: { type: String, required: true },
})

const tabs = computed(() => [
  { name: 'runs', label: __('Runs'), icon: LucideWorkflow },
  { name: 'versions', label: __('Versions'), icon: LucideGitBranch },
  { name: 'activity', label: __('Activity'), icon: ActivityIcon },
])
// The tab lives in the URL hash and the last one is remembered, as on a lead; the split button links each by hash.
const { tabIndex } = useActiveTabManager(tabs, 'lastWorkflowRunsTab', 'runs')

// The SAME resource the canvas loads, under the same cache key — frappe-ui returns the one object for a key, so arriving from the canvas paints the name with no second call (§13).
const workflow = createResource({
  url: 'tatva_connect.workflows.api.get_workflow',
  makeParams: () => ({ name: props.workflowId }),
  cache: ['Workflow', props.workflowId, LENS_CACHE_GENERATION],
  auto: true,
})

const title = computed(() => workflow.data?.workflow_name || props.workflowId)

// Totals for the cards, counted server-side per status the Journey declares — never a status list typed here.
const counts = createResource({
  url: 'tatva_connect.workflow_engine.history.run_counts',
  makeParams: () => ({ workflow: props.workflowId }),
  cache: ['WorkflowRunCounts', props.workflowId],
  auto: true,
})

const cards = computed(() => [
  {
    title: __('Total runs'),
    value: counts.data.total,
    subtitle: counts.data.last_run_at
      ? __('Last run {0}', [formatListDate(counts.data.last_run_at, true)])
      : __('Never run'),
  },
  ...counts.data.statuses.map((s) => ({
    title: __(s.status),
    value: s.total,
    subtitle: '',
  })),
])

// The same orientation line the canvas header carries, from the ONE labeller, so the two cannot disagree.
const subtitle = computed(() => workflowSubtitle(workflow.data))

// The clicked run, read through the same gate as its steps; the modal renders what this returns.
const run = createResource({
  url: 'tatva_connect.workflow_engine.history.journey_state',
})

// runs data is loaded in the ViewControls component
const runs = ref({})
const runsListView = ref(null)
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

// The versions list, loaded by its own ViewControls exactly as the runs list is.
const versions = ref({})
const versionsLoadMore = ref(1)
const versionsResize = ref(1)
const versionsPageCount = ref(20)
const versionControls = ref(null)

const rows = computed(() => listRows(runs.value))
const columns = computed(() => listColumns(runs.value))
const versionRows = computed(() => listRows(versions.value))
const versionColumns = computed(() => listColumns(versions.value))
</script>
