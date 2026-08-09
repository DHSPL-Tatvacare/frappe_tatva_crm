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
      <CustomActions
        v-if="runsListView?.customListActions"
        :actions="runsListView.customListActions"
      />
    </template>
  </LayoutHeader>
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
</template>
<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import ViewControls from '@/components/ViewControls.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import WorkflowRunsListView from './WorkflowRunsListView.vue'
import LucideWorkflow from '~icons/lucide/workflow'
import { formatDate, timeAgo } from '@/utils'
import { createResource } from 'frappe-ui'
import { ref, computed } from 'vue'

const props = defineProps({
  workflowId: { type: String, required: true },
})

// The SAME resource the canvas loads, under the same cache key — frappe-ui returns the one object for a key, so arriving from the canvas paints the name with no second call (§13).
const workflow = createResource({
  url: 'tatva_connect.workflows.api.get_workflow',
  makeParams: () => ({ name: props.workflowId }),
  cache: ['Workflow', props.workflowId],
  auto: true,
})

const title = computed(() => workflow.data?.workflow_name || props.workflowId)

// runs data is loaded in the ViewControls component
const runs = ref({})
const runsListView = ref(null)
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

// A journey carries no currency, float or percent field, so the only typed cells are its dates.
const rows = computed(() => {
  if (!runs.value?.data?.data) return []
  return runs.value.data.data.map((journey) => {
    let _rows = {}
    runs.value.data.rows.forEach((row) => {
      _rows[row] = journey[row]

      let fieldType = runs.value.data.columns?.find(
        (col) => (col.key || col.value) == row,
      )?.type

      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(row)
      ) {
        _rows[row] = formatDate(journey[row], '', true, fieldType == 'Datetime')
      }

      if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(journey[row]),
          timeAgo: __(timeAgo(journey[row])),
        }
      }
    })
    return _rows
  })
})

const columns = computed(() => {
  let _columns = runs.value?.data?.columns || []

  if (_columns.length) {
    _columns = _columns.map((col, index) => {
      if (index === _columns.length - 1) {
        return { ...col, align: 'right' }
      }
      return col
    })
  }

  return _columns
})
</script>
