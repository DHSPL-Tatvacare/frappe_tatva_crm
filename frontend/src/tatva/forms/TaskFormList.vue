<!-- TATVA: Task Forms list page — the native list over CRM Task Type, assembled exactly as the Workflows list. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs v-model="viewControls" routeName="Task Forms" />
    </template>
    <template #right-header>
      <CustomActions
        v-if="taskFormsListView?.customListActions"
        :actions="taskFormsListView.customListActions"
      />
    </template>
  </LayoutHeader>
  <ViewControls
    ref="viewControls"
    v-model="taskForms"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    doctype="CRM Task Type"
  />
  <TaskFormsListView
    v-if="taskForms.data && rows.length"
    ref="taskFormsListView"
    v-model="taskForms.data.page_length_count"
    v-model:list="taskForms"
    :rows="rows"
    :columns="columns"
    :options="{
      showTooltip: false,
      resizeColumn: true,
      rowCount: taskForms.data.row_count,
      totalCount: taskForms.data.total_count,
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
    v-else-if="taskForms.data && !rows.length"
    name="Task Forms"
    :icon="LucideClipboardList"
    :description="__('No task forms match this view.')"
  />
</template>
<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import TaskFormsListView from './TaskFormsListView.vue'
import ViewControls from '@/components/ViewControls.vue'
import LucideClipboardList from '~icons/lucide/clipboard-list'
import { getMeta } from '@/stores/meta'
import { formatListDate } from '@/utils'
import { ref, computed } from 'vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('CRM Task Type')

const taskFormsListView = ref(null)

// task forms data is loaded in the ViewControls component
const taskForms = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

const rows = computed(() => {
  if (
    !taskForms.value?.data?.data ||
    !['list', 'group_by'].includes(taskForms.value.data.view_type)
  )
    return []
  return taskForms.value?.data.data.map((taskForm) => {
    let _rows = {}
    taskForms.value?.data.rows.forEach((row) => {
      _rows[row] = taskForm[row]

      let fieldType = taskForms.value?.data.columns?.find(
        (col) => (col.key || col.value) == row,
      )?.type

      if (fieldType && ['Date', 'Datetime'].includes(fieldType)) {
        _rows[row] = formatListDate(taskForm[row], fieldType == 'Datetime')
      }

      if (fieldType && fieldType == 'Currency') {
        _rows[row] = getFormattedCurrency(row, taskForm)
      }

      if (fieldType && fieldType == 'Float') {
        _rows[row] = getFormattedFloat(row, taskForm)
      }

      if (fieldType && fieldType == 'Percent') {
        _rows[row] = getFormattedPercent(row, taskForm)
      }
    })
    return _rows
  })
})

const columns = computed(() => {
  let _columns = taskForms.value?.data?.columns || []

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
