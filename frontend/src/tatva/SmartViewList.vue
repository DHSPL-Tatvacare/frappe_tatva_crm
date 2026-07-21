<!--
  TATVA: SmartViewList — the read-only list body of a Smart View, built to look and behave like a native
  CRM list (modelled on components/ListViews/TasksListView.vue):

    • Native BOUNDED composition: ListView > ListHeader + ListRows (both mx-3 sm:mx-5) + ListFooter —
      so the table is padded to the page gutter, never full-bleed/stretched, and scrolls horizontally
      on a phone exactly like the native lists.
    • TYPED columns: each column's width comes from its real fieldtype (from get_data) — dates narrow,
      text wider — and Date/Datetime cells are formatted with the native formatDate (no raw ISO).
    • Row click is handled by the PARENT: a Lead-view row IS a lead (-> openLead = the Lead page); an
      Activity-view row IS a CRM Task (-> openTask = the native activity/task modal). We only emit.

  State binds DIRECTLY to the createResource's `list.data` (columns/rows/total are computed off it) — we
  never copy into local refs in onSuccess, because the shared `cache` key serves cache hits WITHOUT
  firing onSuccess, which would leave a second-mount instance showing 0 while the store count showed N.
  The view's `total` is pushed to the store as its lazy count (§6) whenever data lands. Read-only.
-->
<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Toolbar — the native list shape (see ViewControls.vue): ONE row, search left, the
         interactive controls grouped right-aligned. Never wraps into a vertical stack. -->
    <div class="flex shrink-0 items-center gap-2 px-3 py-2 sm:px-5">
      <FormControl
        v-model="search"
        type="text"
        :placeholder="__('Search')"
        class="w-44 sm:w-60"
        @input="onSearch"
      >
        <template #prefix>
          <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
        </template>
      </FormControl>
      <!-- record count is already shown on the tab + in the footer, so it is omitted here -->
      <div class="ml-auto flex items-center gap-2">
        <template v-if="catalogReady">
          <Filter
            v-model="filterModel"
            :doctype="drivingDoctype"
            :fields="filterFields"
            @update="onFilterUpdate"
          />
          <SortBy
            v-model="sortModel"
            :doctype="drivingDoctype"
            :fields="sortFields"
            @update="onSortUpdate"
          />
        </template>
        <!-- Edit the SAVED view (conditions + columns) — the discoverable entry point. -->
        <Button
          v-if="canEdit"
          :tooltip="__('Edit view')"
          icon="edit-2"
          @click="emit('editView')"
        />
      </div>
    </div>

    <div
      v-if="loading && !rows.length"
      class="flex flex-1 items-center justify-center text-sm text-ink-gray-5"
    >
      {{ __('Loading…') }}
    </div>
    <div
      v-else-if="errored"
      class="flex flex-1 items-center justify-center text-sm text-ink-gray-5"
    >
      {{ __('You do not have access to this view.') }}
    </div>
    <div v-else-if="!rows.length" class="flex-1">
      <EmptyState
        name="records"
        :title="__('No records')"
        :description="__('No rows match this view yet.')"
      />
    </div>

    <ListView
      v-else
      :columns="columns"
      :rows="displayRows"
      row-key="name"
      :options="{
        onRowClick: openRow,
        selectable: false,
        showTooltip: true,
        resizeColumn: true,
        emptyState: {
          title: __('No records'),
          description: __('No rows match this view.'),
        },
      }"
      class="flex-1"
    >
      <ListHeader class="mx-3 sm:mx-5">
        <ListHeaderItem
          v-for="column in columns"
          :key="column.key"
          :item="column"
        />
      </ListHeader>
      <ListRows
        v-slot="{ column, item }"
        class="mx-3 sm:mx-5"
        :rows="displayRows"
        :doctype="drivingDoctype"
      >
        <ListRowItem :item="item" :align="column.align" class="overflow-hidden">
          <template #default="{ label }">
            <!-- Select / status-like Link render as a subtle pill (LSQ-style), like the native lists. -->
            <span
              v-if="isPill(column) && label"
              class="inline-flex max-w-full items-center truncate rounded bg-surface-gray-2 px-2 py-0.5 text-sm text-ink-gray-7"
            >
              {{ label }}
            </span>
            <div v-else class="truncate text-base">{{ label }}</div>
          </template>
        </ListRowItem>
      </ListRows>
    </ListView>

    <ListFooter
      v-if="!errored && rows.length"
      v-model="pageLength"
      class="border-t border-outline-gray-1 px-3 py-2 sm:px-5"
      :options="{ rowCount: rows.length, totalCount: total }"
      @loadMore="loadMore"
    />
  </div>
</template>

<script setup>
import {
  ListView,
  ListHeader,
  ListHeaderItem,
  ListRowItem,
  ListFooter,
  FormControl,
  FeatherIcon,
  Button,
  createResource,
} from 'frappe-ui'
import ListRows from '@/components/ListViews/ListRows.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import Filter from '@/components/Filter.vue'
import SortBy from '@/components/SortBy.vue'
import { formatDate } from '@/utils'
import { computed, ref, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { smartViewsStore } from '@/stores/smartViews'
import { filtersToPredicate } from '@/tatva/smartViewPredicate'

const props = defineProps({
  // The CRM Smart View `name` (the doctype row name), driving get_data.
  viewName: { type: String, required: true },
  baseObject: { type: String, default: 'Lead' },
  // Whether the caller may edit this view (shows the Edit-view entry point).
  canEdit: { type: Boolean, default: false },
})
const emit = defineEmits(['openLead', 'openTask', 'editView'])

const store = smartViewsStore()

const search = ref('')
const sort = ref(null) // [field_key, 'asc'|'desc']
const page = ref(1)
const pageLength = ref(50)
const myView = props.viewName

// CRM Task for activity views, CRM Lead for lead views — passed to ListRows for native scroll/grouping.
const drivingDoctype = computed(() =>
  props.baseObject === 'Lead' ? 'CRM Lead' : 'CRM Task',
)

// ---- interactive filter / sort (native primitives fed by the catalog) ----------
// Columns are NOT interactive here: a Smart View IS its curated column set, declared once in the editor.
// A second picker on the toolbar was a rival curation that never persisted. Filter/Sort stay transient.
const viewMeta = computed(() => store.getView(myView) || {})
const catalog = createResource({
  url: 'tatva_connect.smartview.api.field_catalog',
  makeParams: () => ({
    base_object: props.baseObject,
    activity_type:
      props.baseObject === 'Activity' ? viewMeta.value.activity_type || undefined : undefined,
  }),
  auto: true,
})
const catalogReady = computed(() => Array.isArray(catalog.data) && catalog.data.length > 0)
const toField = (c) => ({
  fieldname: c.field_key,
  label: c.label,
  fieldtype: c.fieldtype,
  options: c.options,
})
const filterFields = computed(() =>
  (catalog.data || []).filter((c) => c.filterable).map(toField),
)
const sortFields = computed(() =>
  (catalog.data || [])
    .filter((c) => c.sortable)
    .map((c) => ({ fieldname: c.field_key, label: c.label })),
)

// The native controls bind to these list-shaped models (they read `.data` + `.params`).
const filterModel = ref({ data: {}, params: { filters: {} } })
const sortModel = ref({ data: {}, params: { order_by: '' } })

// Active selections that get folded into get_data's params.
const activeFilters = ref([]) // [[field_key, op, value], …] ANDed on top of the saved predicate

// Filter emit (dict) -> ad-hoc [[field_key, op, value]] the composer already accepts.
function onFilterUpdate(dict) {
  filterModel.value.params.filters = dict || {}
  const pred = filtersToPredicate(dict)
  activeFilters.value = pred ? pred.conditions.map((c) => [c.field, c.operator, c.value]) : []
  page.value = 1
  reload()
}

// SortBy emit is an order_by string ("field dir, …"); the composer takes a single [field, dir].
function onSortUpdate(orderBy) {
  const first = (orderBy || '').split(',')[0].trim()
  sort.value = first ? first.split(' ') : null
  page.value = 1
  reload()
}

// Seed the column picker from the view's own default projection, once, after the first load.
// Column width by real fieldtype — dates narrow, numbers narrow, text wider; the first column (the
// row's name/title) gets a touch more room. Keeps the grid honest instead of a flat 12rem everywhere.
const WIDTHS = {
  Int: '7rem',
  Float: '8rem',
  Currency: '9rem',
  Percent: '7rem',
  Rating: '8rem',
  Check: '6rem',
  Date: '9rem',
  Datetime: '11rem',
  Time: '8rem',
  Select: '10rem',
  Link: '11rem',
  'Dynamic Link': '11rem',
  'Small Text': '16rem',
  Text: '16rem',
  'Long Text': '18rem',
  'Text Editor': '18rem',
}
function widthFor(ft, isFirst) {
  if (isFirst && ['Data', 'Link', 'Dynamic Link', undefined].includes(ft)) return '15rem'
  return WIDTHS[ft] || '12rem'
}

// Native cell formatting: dates via formatDate (raw ISO is the "dirty" look), Check as a tick.
function formatCell(value, ft) {
  if (value === null || value === undefined || value === '') return ''
  if (ft === 'Date') return formatDate(value, 'D MMM YYYY', true)
  if (ft === 'Datetime') return formatDate(value, 'D MMM YYYY, h:mm a')
  if (ft === 'Check') return value ? '✓' : ''
  return value
}
// Select (and status-like Link) get the pill treatment.
function isPill(column) {
  return column.type === 'Select' || column.type === 'Link'
}

function getParams() {
  return {
    view: myView,
    search: search.value || undefined,
    sort: sort.value ? JSON.stringify(sort.value) : undefined,
    filters: activeFilters.value.length ? JSON.stringify(activeFilters.value) : undefined,
    page: page.value,
    page_size: pageLength.value,
  }
}

// The data source. Bind state to list.data (NOT copied in onSuccess) so a cache hit — which skips
// onSuccess — still populates the view.
const list = createResource({
  url: 'tatva_connect.smartview.api.get_data',
  cache: ['smart-view', myView],
  params: getParams(),
})

const errored = computed(() => !!list.error)
const loading = computed(() => list.loading)
const columns = computed(() =>
  (list.data?.columns || []).map((c, i, arr) => ({
    key: c.key,
    label: c.label,
    type: c.fieldtype,
    width: widthFor(c.fieldtype, i === 0),
    // native convention: right-align the last column.
    align: i === arr.length - 1 && arr.length > 1 ? 'right' : 'left',
  })),
)
const rows = computed(() => list.data?.rows || [])
const total = computed(() => list.data?.total || 0)

// Pre-format each row's cells to display strings (ListRowItem shows row[column.key]); keep `name` for nav.
const displayRows = computed(() =>
  rows.value.map((r) => {
    const o = { name: r.name }
    for (const c of columns.value) o[c.key] = formatCell(r[c.key], c.type)
    return o
  }),
)

// §6 lazy count: push this view's total whenever data lands (cache hit OR fresh) — never before load.
// Also seed the column picker once from the view's own default projection.
watch(
  () => list.data,
  (d) => {
    if (!d) return
    store.setCount(myView, Number(d.total) || 0)
  },
  { immediate: true },
)

function reload() {
  list.params = getParams()
  list.reload()
}

const onSearch = useDebounceFn(() => {
  page.value = 1
  reload()
}, 300)

function loadMore() {
  pageLength.value += 50
  reload()
}

onMounted(reload)

// Read-only navigation. Lead view rows ARE leads -> the Lead page; activity rows ARE CRM Tasks ->
// the native task/activity modal (the parent owns the modal mount). row.name is the driving doc name.
function openRow(row) {
  if (!row?.name) return
  if (props.baseObject === 'Lead') emit('openLead', row.name)
  else emit('openTask', row.name)
}

defineExpose({ reload })
</script>
