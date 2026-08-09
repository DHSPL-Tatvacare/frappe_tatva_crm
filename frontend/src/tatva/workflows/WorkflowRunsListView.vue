<!-- TATVA: the rows of one workflow's run history, over CRM Workflow Journey. A sibling of WorkflowsListView (which is LeadsListView's shape) in every respect — same props, same emits, same select banner, same bulk actions, same footer — because a list that behaves differently from the other lists on this site is the thing that goes wrong. The columns are whatever the reader's view says they are; this file decides none of them. Two cells are drawn specially, and only because a raw string would lie: the status word, which carries the colour the canvas and the lead's history tab already give it, and the lead, whose stored value is a docname. -->
<template>
  <ListView
    :columns="columns"
    :rows="rows"
    :options="{
      selectable: options.selectable,
      showTooltip: options.showTooltip,
      resizeColumn: options.resizeColumn,
    }"
    row-key="name"
    @update:selections="(selections) => emit('selectionsChanged', selections)"
  >
    <ListHeader
      class="mx-3 sm:mx-5"
      @columnWidthUpdated="emit('columnWidthUpdated')"
    >
      <ListHeaderItem
        v-for="column in columns"
        :key="column.key"
        :item="column"
        @columnWidthUpdated="emit('columnWidthUpdated', column)"
      />
    </ListHeader>
    <ListRows
      v-slot="{ idx, column, item, row }"
      class="mx-3 sm:mx-5"
      :rows="rows"
      doctype="CRM Workflow Journey"
    >
      <ListRowItem :item="item" :align="column.align" class="overflow-hidden">
        <template #default="{ label }">
          <div
            v-if="['modified', 'creation'].includes(column.key)"
            class="truncate text-base"
            @click="
              (event) =>
                emit('applyFilter', {
                  event,
                  idx,
                  column,
                  item,
                  firstColumn: columns[0],
                })
            "
          >
            <Tooltip :text="item.label">
              <div>{{ item.timeAgo }}</div>
            </Tooltip>
          </div>
          <!-- The one column a reader scans this list FOR, in the engine's own vocabulary: red is a fault, orange is waiting, green finished, blue in flight, grey ended on purpose. A `Badge` theme, never a hand-picked class — the same rule WorkflowsListView follows for lifecycle_state. -->
          <div v-else-if="column.key === 'status'" class="truncate text-base">
            <Badge
              v-if="item"
              variant="subtle"
              size="md"
              :theme="statusTheme(item)"
              :label="__(item)"
              @click="
                (event) =>
                  emit('applyFilter', {
                    event,
                    idx,
                    column,
                    item,
                    firstColumn: columns[0],
                  })
              "
            />
          </div>
          <div v-else-if="column.type === 'Check'">
            <FormControl
              type="checkbox"
              :modelValue="item"
              :disabled="true"
              class="text-ink-gray-9"
            />
          </div>
          <div
            v-else-if="label"
            class="truncate text-base"
            @click="
              (event) =>
                emit('applyFilter', {
                  event,
                  idx,
                  column,
                  item,
                  firstColumn: columns[0],
                })
            "
          >
            {{ getLabel(label, column, row) }}
          </div>
        </template>
      </ListRowItem>
    </ListRows>
    <ListSelectBanner>
      <template #actions="{ selections, unselectAll }">
        <Dropdown
          :options="listBulkActionsRef.bulkActions(selections, unselectAll)"
        >
          <Button icon="more-horizontal" variant="ghost" />
        </Dropdown>
      </template>
    </ListSelectBanner>
  </ListView>
  <ListFooter
    v-model="pageLengthCount"
    class="border-t px-3 py-2 sm:px-5"
    :options="{
      rowCount: options.rowCount,
      totalCount: options.totalCount,
    }"
    @loadMore="emit('loadMore')"
  />
  <ListBulkActions
    ref="listBulkActionsRef"
    v-model="list"
    doctype="CRM Workflow Journey"
    :options="{
      hideAssign: true,
      hideEdit: true,
      hideDelete: true,
    }"
  />
</template>
<script setup>
import ListBulkActions from '@/components/ListBulkActions.vue'
import ListRows from '@/components/ListViews/ListRows.vue'
import { linkTitle } from '@/tatva/linkTitle'
import { isTranslatable, formatDuration } from '@/utils'
import {
  ListView,
  ListHeader,
  ListHeaderItem,
  ListSelectBanner,
  ListRowItem,
  ListFooter,
  Badge,
  Button,
  Dropdown,
  FormControl,
  Tooltip,
} from 'frappe-ui'
import { ref, computed, watch } from 'vue'
import { statusTheme } from './journeyStatus'

defineProps({
  rows: { type: Array, required: true },
  columns: { type: Array, required: true },
  options: {
    type: Object,
    default: () => ({
      selectable: true,
      showTooltip: true,
      resizeColumn: false,
      totalCount: 0,
      rowCount: 0,
    }),
  },
})

const emit = defineEmits([
  'loadMore',
  'updatePageCount',
  'columnWidthUpdated',
  'applyFilter',
  'applyLikeFilter',
  'likeDoc',
  'selectionsChanged',
])

const pageLengthCount = defineModel({ type: Number })
const list = defineModel('list', { type: Object })

// `subject_name` is a Dynamic Link whose target is the row's own `subject_doctype`, so the ROW is what says which doctype to title from — the column alone resolves nothing (tatva/linkTitle.js).
function getLabel(label, column, row) {
  if (column.type === 'Duration') return formatDuration(label)
  return (
    linkTitle(label, column, list.value, row) ??
    (column.options && isTranslatable(column.options) ? __(label) : label)
  )
}

watch(pageLengthCount, (val, old_value) => {
  if (val === old_value) return
  emit('updatePageCount', val)
})

const listBulkActionsRef = ref(null)

defineExpose({
  customListActions: computed(
    () => listBulkActionsRef.value?.customListActions,
  ),
})
</script>
