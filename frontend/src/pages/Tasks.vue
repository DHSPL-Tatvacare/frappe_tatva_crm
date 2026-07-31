<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs v-model="viewControls" routeName="Tasks" />
    </template>
    <template #right-header>
      <CustomActions
        v-if="tasksListView?.customListActions"
        :actions="tasksListView.customListActions"
      />
      <Button
        variant="solid"
        :label="__('Create')"
        iconLeft="plus"
        @click="createTask"
      />
    </template>
  </LayoutHeader>
  <ViewControls
    ref="viewControls"
    v-model="tasks"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    doctype="CRM Task"
    :options="{
      allowedViews: ['list', 'group_by', 'kanban', 'calendar'],
    }"
  />
  <KanbanView
    v-if="$route.params.viewType == 'kanban' && rows.length"
    v-model="tasks"
    :options="{
      onClick: (row) => showTask(row.name),
      onNewClick: (column) => createTask(column),
    }"
    @update="(data) => viewControls.updateKanbanSettings(data)"
    @loadMore="(columnName) => viewControls.loadMoreKanban(columnName)"
  >
    <template #title="{ titleField, itemName }">
      <div class="flex items-center gap-2">
        <div v-if="titleField === 'status'">
          <TaskStatusIcon :status="getRow(itemName, titleField).label" />
        </div>
        <div v-else-if="titleField === 'priority'">
          <TaskPriorityIcon :priority="getRow(itemName, titleField).label" />
        </div>
        <div v-else-if="titleField === 'assigned_to'">
          <Avatar
            v-if="getRow(itemName, titleField).full_name"
            class="flex items-center"
            :image="getRow(itemName, titleField).user_image"
            :label="getRow(itemName, titleField).full_name"
            size="sm"
          />
        </div>
        <div
          v-if="['modified', 'creation'].includes(titleField)"
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, titleField).label">
            <div>{{ getRow(itemName, titleField).timeAgo }}</div>
          </Tooltip>
        </div>
        <div
          v-else-if="getRow(itemName, titleField).label"
          class="truncate text-base"
        >
          {{ getRow(itemName, titleField).label }}
        </div>
        <div v-else class="text-ink-gray-4">{{ __('No Title') }}</div>
      </div>
    </template>
    <template #fields="{ fieldName, itemName }">
      <div
        v-if="getRow(itemName, fieldName).label"
        class="truncate flex items-center gap-2"
      >
        <div v-if="fieldName === 'status'">
          <TaskStatusIcon
            class="size-3"
            :status="getRow(itemName, fieldName).label"
          />
        </div>
        <div v-else-if="fieldName === 'priority'">
          <TaskPriorityIcon :priority="getRow(itemName, fieldName).label" />
        </div>
        <div v-else-if="fieldName === 'assigned_to'">
          <Avatar
            v-if="getRow(itemName, fieldName).full_name"
            class="flex items-center"
            :image="getRow(itemName, fieldName).user_image"
            :label="getRow(itemName, fieldName).full_name"
            size="sm"
          />
        </div>
        <div
          v-if="['modified', 'creation'].includes(fieldName)"
          class="truncate text-base"
        >
          <Tooltip :text="getRow(itemName, fieldName).label">
            <div>{{ getRow(itemName, fieldName).timeAgo }}</div>
          </Tooltip>
        </div>
        <!-- TATVA: the SAME renderer the list column uses, on the same server stamp. -->
        <div v-else-if="cardBadge(fieldName, itemName)">
          <Badge variant="subtle" v-bind="cardBadge(fieldName, itemName)" />
        </div>
        <!-- TATVA: a date reads as the list reads it, never as a stored timestamp. -->
        <div v-else-if="cardDate(fieldName, itemName)" class="truncate text-base">
          {{ cardDate(fieldName, itemName) }}
        </div>
        <div
          v-else-if="fieldName == 'description'"
          class="truncate text-base max-h-44"
        >
          <TextEditor
            v-if="getRow(itemName, fieldName).label"
            :content="getRow(itemName, fieldName).label"
            :editable="false"
            editor-class="!prose-sm max-w-none focus:outline-none"
            class="flex-1 overflow-hidden"
          />
        </div>
        <div v-else class="truncate text-base">
          {{ getRow(itemName, fieldName).label }}
        </div>
      </div>
    </template>
    <template #actions="{ itemName }">
      <div class="flex gap-2 items-center justify-between">
        <div>
          <Button
            v-if="getRow(itemName, 'reference_docname').label"
            class="-ml-2"
            variant="ghost"
            size="sm"
            :label="
              getRow(itemName, 'reference_doctype').label == 'CRM Deal'
                ? __('Deal')
                : __('Lead')
            "
            :iconRight="ArrowUpRightIcon"
            @click.stop="
              redirect(
                getRow(itemName, 'reference_doctype').label,
                getRow(itemName, 'reference_docname').label,
              )
            "
          />
        </div>
        <Dropdown
          class="flex items-center gap-2"
          :options="actions(itemName)"
          variant="ghost"
          @click.stop.prevent
        >
          <Button icon="more-horizontal" variant="ghost" />
        </Dropdown>
      </div>
    </template>
  </KanbanView>
  <!-- TATVA: a view type renders from the SAME list resource; the visible window drives its params. -->
  <CalendarView
    v-else-if="$route.params.viewType == 'calendar'"
    v-model="tasks"
    :options="{
      onClick: (row) => showTask(row.name),
      onNewClick: (dueDate) => createTask(dueDate),
    }"
  />
  <TasksListView
    v-else-if="tasks.data && rows.length"
    ref="tasksListView"
    v-model="tasks.data.page_length_count"
    v-model:list="tasks"
    :rows="rows"
    :columns="columns"
    :options="{
      showTooltip: false,
      resizeColumn: true,
      rowCount: tasks.data.row_count,
      totalCount: tasks.data.total_count,
    }"
    @loadMore="() => loadMore++"
    @columnWidthUpdated="() => triggerResize++"
    @updatePageCount="(count) => (updatedPageCount = count)"
    @showTask="showTask"
    @applyFilter="(data) => viewControls.applyFilter(data)"
    @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
    @likeDoc="(data) => viewControls.likeDoc(data)"
    @selectionsChanged="
      (selections) => viewControls.updateSelections(selections)
    "
  />
  <EmptyState
    v-else-if="tasks.data && !rows.length"
    name="Tasks"
    :icon="Email2Icon"
  />
  <!-- TATVA: the ONE native task modal for the global list / kanban. New Task has no lead context, so
       it shows the scoped lead picker; a row opens that exact task (loaded by name via task_detail). -->
  <!-- v-if + v-model is the stock contract (GlobalModals/DoctypeModals): v-if gives a fresh modal per open, so the previous task's state can never paint first. -->
  <TatvaTaskModal
    v-if="tcModalOpen"
    v-model="tcModalOpen"
    :task="tcTask"
    :mode="tcMode"
    :defaultDueDate="tcDueDate"
    @saved="tasks.reload()"
  />
</template>

<script setup>
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import CustomActions from '@/components/CustomActions.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import TaskPriorityIcon from '@/components/Icons/TaskPriorityIcon.vue'
import Email2Icon from '@/components/Icons/Email2Icon.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import ViewControls from '@/components/ViewControls.vue'
import TasksListView from '@/components/ListViews/TasksListView.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import KanbanView from '@/components/Kanban/KanbanView.vue'
import CalendarView from '@/components/ListViews/CalendarView.vue'
import TatvaTaskModal from '@/tatva/TaskModal.vue' // TATVA: the one native task modal (create/edit/view/complete)
import { linkTitleFor } from '@/tatva/linkTitle' // TATVA: the one reader of the _link_titles map (group-by header)
import { derivedBadge } from '@/tatva/derivedField' // TATVA: the ONE renderer for a derived cell
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import { formatDate, timeAgo } from '@/utils'
import { Badge, Tooltip, Avatar, TextEditor, Dropdown, call } from 'frappe-ui'
import { computed, ref, h } from 'vue'
import { useRouter } from 'vue-router'

const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta('CRM Task')
const { getUser } = usersStore()

const router = useRouter()

const tasksListView = ref(null)

// tasks data is loaded in the ViewControls component
const tasks = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)
const viewControls = ref(null)

function getRow(name, field) {
  function getValue(value) {
    if (value && typeof value === 'object') {
      return value
    }
    return { label: value }
  }
  return getValue(rows.value?.find((row) => row.name == name)[field])
}

// TATVA: a card field's descriptor — the SAME `fields` list the list column and the board header read.
const cardField = (fieldName) =>
  tasks.value?.data?.fields?.find((f) => f.fieldname === fieldName)

const cardBadge = (fieldName, itemName) =>
  derivedBadge(cardField(fieldName), getRow(itemName, fieldName).label)

// TATVA: `parseRows` leaves a due date RAW because the list column renders it itself, so a card printed
// the stored timestamp. Formatted here off the field's own TYPE — never a fieldname — in the same shapes
// TasksListView.vue:51 and TaskArea.vue:26 already use, so a card and its column read alike.
function cardDate(fieldName, itemName) {
  const fieldtype = cardField(fieldName)?.fieldtype
  if (!['Date', 'Datetime'].includes(fieldtype)) return null
  const value = getRow(itemName, fieldName).label
  if (!value) return null
  return formatDate(value, fieldtype === 'Datetime' ? 'D MMM, hh:mm a' : 'D MMM YYYY')
}

const rows = computed(() => {
  if (!tasks.value?.data?.data) return []

  // TATVA: group-by reshapes the flat rows into [{group, label, rows}] — the SAME canonical pattern
  // Leads/Deals use. Without it the group-by view rendered flat ("showing but not grouping").
  if (tasks.value.data.view_type === 'group_by') {
    if (!tasks.value?.data.group_by_field?.fieldname) return []
    return getGroupedByRows(
      tasks.value.data.data,
      tasks.value.data.group_by_field,
      tasks.value.data.columns,
    )
  }

  if (tasks.value.data.view_type === 'kanban') {
    return getKanbanRows(tasks.value.data.data, tasks.value.data.fields)
  }

  openTaskFromURL()
  return parseRows(tasks.value?.data.data, tasks.value?.data.columns)
})

// TATVA: bucket the flat rows by the chosen group-by field's value (status/priority/assignee/owner…),
// mirroring Leads.getGroupedByRows. A status group carries the native TaskStatusIcon in its header.
// Grouping stays keyed on the raw value: a Link to a grain master holds a composite `::` PK and two
// grains may share a type_name, so keying on the title would merge them. The HEADER reads the same
// `_link_titles` map the cells do — never a name column written back into the row.
function getGroupedByRows(listRows, groupByField, columns) {
  const df = tasks.value?.data?.fields?.find(
    (f) => f.fieldname === groupByField.fieldname,
  )
  const linkTarget = df?.fieldtype === 'Link' ? df.options : null
  return (groupByField.options || []).map((option) => {
    const filtered = option
      ? listRows.filter((r) => r[groupByField.fieldname] == option)
      : listRows.filter((r) => !r[groupByField.fieldname])
    const group = {
      label: groupByField.label,
      group: option || __(' '),
      groupLabel: linkTitleFor(linkTarget, option, tasks.value),
      collapsed: false,
      rows: parseRows(filtered, columns),
    }
    if (groupByField.fieldname === 'status') {
      group.icon = () => h(TaskStatusIcon, { status: option, class: 'size-3' })
    }
    // A derived group header wears the same badge as its cell and card, from the one renderer.
    const badge = derivedBadge(groupByField, option)
    if (badge) group.badge = badge
    return group
  })
}

const columns = computed(() => {
  let _columns = tasks.value?.data?.columns || []

  // Set align right for last column
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

function getKanbanRows(data, columns) {
  let _rows = []
  data.forEach((column) => {
    column.data?.forEach((row) => {
      _rows.push(row)
    })
  })
  return parseRows(_rows, columns)
}

function parseRows(rows, columns = []) {
  let view_type = tasks.value.data.view_type
  let key = view_type === 'kanban' ? 'fieldname' : 'key'
  let type = view_type === 'kanban' ? 'fieldtype' : 'type'

  return rows.map((task) => {
    let _rows = {}
    tasks.value?.data.rows.forEach((row) => {
      _rows[row] = task[row]

      let fieldType = columns?.find((col) => (col[key] || col.value) == row)?.[
        type
      ]

      if (
        fieldType &&
        ['Date', 'Datetime'].includes(fieldType) &&
        !['modified', 'creation', 'due_date'].includes(row)
      ) {
        _rows[row] = formatDate(task[row], '', true, fieldType == 'Datetime')
      }

      if (fieldType && fieldType == 'Currency') {
        _rows[row] = getFormattedCurrency(row, task)
      }

      if (fieldType && fieldType == 'Float') {
        _rows[row] = getFormattedFloat(row, task)
      }

      if (fieldType && fieldType == 'Percent') {
        _rows[row] = getFormattedPercent(row, task)
      }

      if (['modified', 'creation'].includes(row)) {
        _rows[row] = {
          label: formatDate(task[row]),
          timeAgo: __(timeAgo(task[row])),
        }
      } else if (row == 'assigned_to') {
        _rows[row] = {
          label: task.assigned_to && getUser(task.assigned_to).full_name,
          ...(task.assigned_to && getUser(task.assigned_to)),
        }
      }
    })
    return _rows
  })
}

// TATVA: every task (plain + activity) opens the one native TaskModal — same renderer as the lead board.
// The modal resolves its own map config (composables/mapConfig.js); this page never fetches one.
const tcModalOpen = ref(false)
const tcTask = ref(null)
const tcMode = ref('view')
const tcDueDate = ref('') // the calendar's clicked cell; '' everywhere else, so create is unchanged

// Row / kanban click → view that exact task (TaskModal loads it by name; handles plain + activity tasks).
function showTask(name) {
  tcTask.value = { name }
  tcMode.value = 'view'
  tcModalOpen.value = true
}

// New Task on the global list → create with no lead context (TaskModal shows the scoped lead picker).
// The header button hands us a MouseEvent and the kanban a column; only the calendar hands a datetime.
function createTask(dueDate) {
  tcTask.value = null
  tcMode.value = 'create'
  tcDueDate.value = typeof dueDate === 'string' ? dueDate : ''
  tcModalOpen.value = true
}

function actions(name) {
  return [
    {
      label: __('Delete'),
      icon: 'trash-2',
      onClick: () => {
        deleteTask(name)
        tasks.value.reload()
      },
    },
  ]
}

async function deleteTask(name) {
  await call('frappe.client.delete', {
    doctype: 'CRM Task',
    name,
  })
}

function redirect(doctype, docname) {
  if (!docname) return
  let name = doctype == 'CRM Deal' ? 'Deal' : 'Lead'
  let params = { leadId: docname }
  if (name == 'Deal') {
    params = { dealId: docname }
  }
  router.push({ name: name, params: params })
}

const openTaskFromURL = () => {
  const searchParams = new URLSearchParams(window.location.search)
  const taskName = searchParams.get('open')

  if (taskName && rows.value?.length) {
    showTask(parseInt(taskName))
    searchParams.delete('open')
    window.history.replaceState(null, '', window.location.pathname)
  }
}
</script>
