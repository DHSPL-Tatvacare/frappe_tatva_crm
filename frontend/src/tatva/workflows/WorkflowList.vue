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

  <Dialog v-model="showCreate" :options="{ title: __('New Workflow') }">
    <template #body-content>
      <FormControl
        v-model="newName"
        :label="__('Workflow Name')"
        :placeholder="__('e.g. Physical Visit Follow-up')"
        @keyup.enter="createWorkflow"
      />
      <p class="mt-2 text-sm text-ink-gray-5">
        {{ __('Starts on a blank canvas. Drop in a Trigger and build the flow from there.') }}
      </p>
    </template>
    <template #actions>
      <Button
        variant="solid"
        class="w-full"
        :label="__('Create')"
        :loading="creating"
        @click="createWorkflow"
      />
    </template>
  </Dialog>
</template>
<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import WorkflowsListView from './WorkflowsListView.vue'
import ViewControls from '@/components/ViewControls.vue'
import LucideWorkflow from '~icons/lucide/workflow'
import { getMeta } from '@/stores/meta'
import { formatDate, timeAgo } from '@/utils'
import { Button, Dialog, FormControl, call, toast } from 'frappe-ui'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/components/ListViews/EmptyState.vue'

const router = useRouter()

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('CRM Workflow')

const workflowsListView = ref(null)

// Create: a blank Draft, seeded with nothing. A Draft is not validated and mints no Version, so an empty
// canvas is a legal resting state — this comment used to claim a Terminal node was seeded, and the dialog
// told the author the same thing. Neither was true: the backend stopped seeding and the copy stayed.
const showCreate = ref(false)
const newName = ref('')
const creating = ref(false)

async function createWorkflow() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  try {
    const doc = await call('tatva_connect.workflows.api.create_workflow', {
      workflow_name: name,
    })
    showCreate.value = false
    newName.value = ''
    router.push({ name: 'Workflow', params: { workflowId: doc.name } })
  } catch (e) {
    const msgs = e?.messages?.length ? e.messages : [e?.message || __('Create failed')]
    msgs.forEach((m) => toast.error(m))
  } finally {
    creating.value = false
  }
}

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

      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation'].includes(row)
      ) {
        _rows[row] = formatDate(workflow[row], '', true, fieldType == 'Datetime')
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

      if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(workflow[row]),
          timeAgo: __(timeAgo(workflow[row])),
        }
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
