<!-- TATVA: Workflows list page. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs v-model="viewControls" routeName="Workflows" />
    </template>
    <template #right-header>
      <CustomActions
        v-if="workflowsListView?.customListActions"
        :actions="workflowsListView.customListActions"
      />
      <Button
        variant="solid"
        :label="__('Create')"
        iconLeft="plus"
        @click="showCreate = true"
      />
    </template>
  </LayoutHeader>
  <ViewControls
    ref="viewControls"
    v-model="workflows"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    doctype="CRM Workflow"
  />
  <WorkflowsListView
    v-if="workflows.data && rows.length"
    ref="workflowsListView"
    v-model="workflows.data.page_length_count"
    v-model:list="workflows"
    :rows="rows"
    :columns="columns"
    :options="{
      showTooltip: false,
      resizeColumn: true,
      rowCount: workflows.data.row_count,
      totalCount: workflows.data.total_count,
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
    v-else-if="workflows.data && !rows.length"
    name="Workflows"
    :icon="LucideWorkflow"
  />

  <WorkflowNameDialog v-if="showCreate" v-model="showCreate" />
</template>
<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import WorkflowsListView from './WorkflowsListView.vue'
import WorkflowNameDialog from './WorkflowNameDialog.vue'
import ViewControls from '@/components/ViewControls.vue'
import LucideWorkflow from '~icons/lucide/workflow'
import { getMeta } from '@/stores/meta'
import { formatListDate } from '@/utils'
import { Button } from 'frappe-ui'
import { ref, computed } from 'vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('CRM Workflow')

const workflowsListView = ref(null)

// Create: a blank Draft through the one dialog Duplicate also uses.
const showCreate = ref(false)

// workflows data is loaded in the ViewControls component
const workflows = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

const rows = computed(() => {
  if (
    !workflows.value?.data?.data ||
    !['list', 'group_by'].includes(workflows.value.data.view_type)
  )
    return []
  return workflows.value?.data.data.map((workflow) => {
    let _rows = {}
    workflows.value?.data.rows.forEach((row) => {
      _rows[row] = workflow[row]

      let fieldType = workflows.value?.data.columns?.find(
        (col) => (col.key || col.value) == row,
      )?.type

      if (fieldType && ['Date', 'Datetime'].includes(fieldType)) {
        _rows[row] = formatListDate(workflow[row], fieldType == 'Datetime')
      }

      if (fieldType && fieldType == 'Currency') {
        _rows[row] = getFormattedCurrency(row, workflow)
      }

      if (fieldType && fieldType == 'Float') {
        _rows[row] = getFormattedFloat(row, workflow)
      }

      if (fieldType && fieldType == 'Percent') {
        _rows[row] = getFormattedPercent(row, workflow)
      }
    })
    return _rows
  })
})

const columns = computed(() => {
  let _columns = workflows.value?.data?.columns || []

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
