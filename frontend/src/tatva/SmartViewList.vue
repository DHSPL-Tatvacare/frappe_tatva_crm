<!-- TATVA: SmartViewList — the read-only body of a Smart View as a native CRM list: typed columns, rows bound to `list.data`, Load More widens one window, row clicks emitted to the parent. -->
<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Toolbar in the native ViewControls shape: one non-wrapping row, search left, controls right, same `py-4` rhythm. -->
    <div class="flex shrink-0 items-center gap-2 px-3 py-4 sm:px-5">
      <!-- Mobile: an open search takes the whole row (as ActivityHeader does); closed, it is an icon beside the other controls. -->
      <template v-if="isMobileView && searchOpen">
        <FormControl
          ref="searchInput"
          v-model="search"
          type="text"
          :placeholder="__('Search')"
          class="flex-1"
          @input="onSearch"
          @blur="onSearchBlur"
        >
          <template #prefix>
            <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
          </template>
        </FormControl>
        <Button icon="x" variant="ghost" @click="closeSearch" />
      </template>
      <template v-else>
        <FormControl
          v-if="!isMobileView"
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
          <Button
            v-if="isMobileView"
            :tooltip="__('Search')"
            icon="search"
            variant="ghost"
            @click="openSearch"
          />
          <!-- The native list's refresh: re-runs the same query through the same path, with `loading` shown on the button. -->
          <Button
            :tooltip="__('Refresh')"
            :icon="RefreshIcon"
            :loading="loading"
            @click="reload"
          />
          <!-- A saved filter combination is a fact about THIS view, so the view is the surface it hangs off. -->
          <FilterPresets
            :referenceDoctype="'CRM Smart View'"
            :referenceName="myView"
            :filters="filterModel.params.filters"
            :sort="sortModel.params.order_by"
            :hideLabel="isMobileView"
            @apply="onPresetApply"
          />
          <!-- Guarded on each control's own fields: handed an empty list, Filter/SortBy fetch the whole ungrained doctype meta instead. -->
          <template v-if="filterFields.length">
            <!-- On a phone these collapse to icons via `hideLabel`, so the toolbar never wraps. -->
            <Filter
              v-model="filterModel"
              :doctype="drivingDoctype"
              :fields="filterFields"
              :hideLabel="isMobileView"
              @update="onFilterUpdate"
            />
          </template>
          <template v-if="sortFields.length">
            <SortBy
              v-model="sortModel"
              :doctype="drivingDoctype"
              :fields="sortFields"
              :hideLabel="isMobileView"
              @update="onSortUpdate"
            />
          </template>
          <!-- View-level actions (edit, share, export) live behind the native `…` overflow; an item is absent, not disabled, without permission. -->
          <Dropdown
            v-if="menuItems.length"
            placement="right"
            :options="[
              { group: __('Options'), hideLabel: true, items: menuItems },
            ]"
          >
            <template #default>
              <Button :tooltip="__('More Options')" icon="more-horizontal" />
            </template>
          </Dropdown>
        </div>
      </template>
    </div>

    <!-- The app's own indicator, not a bare word: every other surface waits with this shape. -->
    <div
      v-if="loading && !rows.length"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-ink-gray-5"
    >
      <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
      <span>{{ __('Loading…') }}</span>
    </div>
    <!-- DENIED is only a server PermissionError; every other failure is FAILED and offers Retry. -->
    <div
      v-else-if="denied"
      class="flex flex-1 items-center justify-center text-sm text-ink-gray-5"
    >
      {{ __('You do not have access to this view.') }}
    </div>
    <div
      v-else-if="failed"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-ink-gray-5"
    >
      <div>{{ __('Could not load this view.') }}</div>
      <Button :label="__('Retry')" @click="reload" />
    </div>
    <div v-else-if="!rows.length" class="flex-1">
      <EmptyState
        name="records"
        :title="emptyTitle"
        :description="emptyDescription"
      />
    </div>

    <ListView
      v-else
      :columns="columns"
      :rows="rows"
      row-key="name"
      :options="{
        onRowClick: openRow,
        selectable: true,
        // Off, as on the native lists: ListRowItem tooltips the raw value, i.e. a Link's composite PK or a raw ISO date.
        showTooltip: false,
        resizeColumn: true,
      }"
      class="flex-1"
    >
      <ListHeader class="mx-3 sm:mx-5">
        <ListHeaderItem
          v-for="column in columns"
          :key="column.key"
          :item="column"
          @columnWidthUpdated="onColumnWidth"
        />
      </ListHeader>
      <ListRows
        v-slot="{ column, item, row }"
        :rows="rows"
        :doctype="drivingDoctype"
        :scrollKey="myView"
      >
        <ListRowItem :item="item" :align="column.align" class="overflow-hidden">
          <template #default>
            <!-- The pinned Lead ID column: the row's own ID as the lead chip every other listing draws. -->
            <LeadCell
              v-if="column.identity"
              :value="row.name"
              :column="LEAD_REF"
              :row="row"
              :list="list"
            />
            <!-- Assignees are avatars, drawn the way every native list draws them (Leads.vue:184). -->
            <div
              v-else-if="column.fieldname === '_assign'"
              class="flex items-center truncate"
            >
              <MultipleAvatar :avatars="assignees(row[column.key])" size="sm" />
            </div>
            <!-- Check and Rating render with the native controls, as LeadsListView draws them. -->
            <FormControl
              v-else-if="column.type === 'Check'"
              type="checkbox"
              :modelValue="Boolean(row[column.key])"
              :disabled="true"
              class="text-ink-gray-9"
            />
            <RatingInput
              v-else-if="column.type === 'Rating'"
              :value="row[column.key]"
              :max="Number(column.options) || 5"
              :disabled="true"
              class="!opacity-100 flex-nowrap overflow-auto"
            />
            <!-- Every other value reads as the native lists read it: plain, truncated text. -->
            <div v-else class="truncate text-base">{{ cellText(row, column) }}</div>
          </template>
        </ListRowItem>
      </ListRows>
      <!-- The native selection banner, driven by the native bulk component — same pipeline as every list. -->
      <TatvaSelectBanner>
        <template #actions="{ selections, unselectAll }">
          <Dropdown :options="listBulkActionsRef.bulkActions(selections, unselectAll)">
            <Button icon="more-horizontal" variant="ghost" />
          </Dropdown>
        </template>
      </TatvaSelectBanner>
    </ListView>

    <!-- The driving doctype is the bulk target: Lead rows are CRM Leads, Activity rows are CRM Tasks. -->
    <ListBulkActions
      v-if="rows.length"
      ref="listBulkActionsRef"
      v-model="bulkList"
      :doctype="drivingDoctype"
      :options="bulkOptions"
    />

    <!-- TATVA: the ONE export dialog. No `hasDerived`: this re-runs get_data, so derived fields ARE in the file. -->
    <ExportDialog
      v-model="showExport"
      :total="total || 0"
      :rowLimit="exportJob.rowLimit"
      :preparing="exportJob.preparing"
      @download="download"
    />

    <SmartViewShareDialog
      v-if="showShare"
      v-model="showShare"
      :viewName="viewName"
      :isStandard="Boolean(viewMeta.is_standard)"
      @changed="emit('sharingChanged')"
    />

    <!-- Stock ListFooter, both slots left alone: it retires Load More itself once rowCount reaches totalCount. -->
    <ListFooter
      v-if="!denied && !failed && rows.length"
      :modelValue="pageLengthCount"
      class="border-t border-outline-gray-1 px-3 py-2 sm:px-5"
      :options="{ rowCount: rows.length, totalCount: total }"
      @update:modelValue="updatePageLength"
      @loadMore="updatePageLength(pageLengthCount, true)"
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
  Dropdown,
  LoadingIndicator,
  call,
  createResource,
} from 'frappe-ui'
import TatvaSelectBanner from '@/tatva/TatvaSelectBanner.vue'
import RefreshIcon from '@/components/Icons/RefreshIcon.vue'
import ExportIcon from '@/components/Icons/ExportIcon.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import SmartViewShareDialog from '@/tatva/SmartViewShareDialog.vue'
import FilterPresets from '@/tatva/FilterPresets.vue'
import { useExportJob } from '@/tatva/useExportJob'
// TATVA: the one export dialog, shared with the native list.
import ExportDialog from '@/tatva/ExportDialog.vue'
import ListRows from '@/components/ListViews/ListRows.vue'
import ListBulkActions from '@/components/ListBulkActions.vue'
import LeadCell from '@/tatva/LeadCell.vue'
import MultipleAvatar from '@/components/MultipleAvatar.vue'
import RatingInput from '@/components/Controls/RatingInput.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import Filter from '@/components/Filter.vue'
import SortBy from '@/components/SortBy.vue'
import { widthFor, formatCell, alignFor } from '@/tatva/listColumns'
import { linkTitleFor } from '@/tatva/linkTitle'
import { computed, h, nextTick, ref, watch, onActivated, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { isMobileView } from '@/composables/settings'
import { smartViewsStore } from '@/stores/smartViews'
import { usersStore } from '@/stores/users'
import { getMeta } from '@/stores/meta'
import { filtersToPredicate } from '@/tatva/smartViewPredicate'
import { readArrival, dropArrival } from '@/tatva/drillFilters' // TATVA: the same arrival the dashboard drill uses
import { coalescedReload } from '@/tatva/coalescedReload.js'
import { catalogParams } from '@/tatva/smartViewCatalog'

const props = defineProps({
  // The CRM Smart View `name` (the doctype row name), driving get_data.
  viewName: { type: String, required: true },
  baseObject: { type: String, default: 'Lead' },
  // Whether the caller may edit this view (shows the Edit-view entry point).
  canEdit: { type: Boolean, default: false },
  // Bumped by the page when this view is saved; a kept-alive instance applies it on its next activation.
  revision: { type: Number, default: 0 },
})
const emit = defineEmits(['openLead', 'openTask', 'editView', 'sharingChanged'])

const route = useRoute()
const router = useRouter()

const store = smartViewsStore()
const { getUser } = usersStore()
// The doctype's own precision and the site's currency — the same store the native list formats through.
const { getFormattedCurrency, getFormattedFloat, getFormattedPercent } = getMeta(
  props.baseObject === 'Lead' ? 'CRM Lead' : 'CRM Task',
)

const search = ref('')
const sort = ref(null) // [field_key, 'asc'|'desc']
// The native list's pair: `pageLengthCount` is the footer's size, `pageLength` the rows asked for.
const pageLengthCount = ref(50)
const pageLength = ref(50)
// Computed, not a setup snapshot: the active view can change without a route change (deleting the first view).
const myView = computed(() => props.viewName)

// Is the TOOLBAR narrowing the view right now? Decides both the badge and which empty state is honest.
const narrowed = computed(
  () => Boolean(search.value) || activeFilters.value.length > 0,
)

// An empty screen must name the REASON it is empty: the toolbar you set, or the view itself.
const emptyTitle = computed(() =>
  narrowed.value ? __('No matches') : __('No records'),
)
const emptyDescription = computed(() =>
  narrowed.value
    ? __(
        'Nothing matches your search or filters. Clear them to see the whole view.',
      )
    : __('No rows match this view yet.'),
)

// CRM Task for activity views, CRM Lead for lead views — passed to ListRows for native scroll/grouping.
const drivingDoctype = computed(() =>
  props.baseObject === 'Lead' ? 'CRM Lead' : 'CRM Task',
)

// ---- filter / sort: native primitives fed by the catalog; columns are the view's own set, so Filter/Sort stay transient ----
const viewMeta = computed(() => store.getView(myView.value) || {})
// Cached by scope and not `auto` (frappe-ui reloads an `auto` resource on every re-creation); fetched once on mount.
const catalog = createResource({
  url: 'tatva_connect.smartview.api.field_catalog',
  // Grain is in the key too: two views of one base object resolve different fields.
  cache: [
    'smart-view-catalog',
    props.baseObject,
    viewMeta.value?.activity_type || '',
    viewMeta.value?.vertical || '',
    viewMeta.value?.group || '',
    viewMeta.value?.program || '',
  ],
  // Scoped to THIS view, or the picker offers a field `get_data` will refuse to resolve.
  makeParams: () => catalogParams({ ...viewMeta.value, base_object: props.baseObject }),
})
// `link_query` and `grain_options` ride along: a view names this column `lead:program`, so its scoping travels with the field or this surface offers the whole master.
const toField = (c) => ({
  fieldname: c.field_key,
  // `value` too: Autocomplete maps a selection back to its label by `option.value`, or it displays the raw field key.
  value: c.field_key,
  label: c.label,
  fieldtype: c.fieldtype,
  options: c.options,
  link_query: c.link_query,
  grain_options: c.grain_options,
})
const filterFields = computed(() =>
  (catalog.data || []).filter((c) => c.filterable).map(toField),
)
const sortFields = computed(() =>
  (catalog.data || [])
    .filter((c) => c.sortable)
    .map((c) => ({ fieldname: c.field_key, value: c.field_key, label: c.label })),
)

// The native controls bind to these list-shaped models (they read `.data` + `.params`).
const filterModel = ref({ data: {}, params: { filters: {} } })
const sortModel = ref({ data: {}, params: { order_by: '' } })

// Active selections that get folded into get_data's params.
const activeFilters = ref([]) // [[field_key, op, value], …] ANDed on top of the saved predicate

// Setting state and fetching are separate, so a preset sets both halves for one request.

// Filter emit (dict) -> ad-hoc [[field_key, op, value]] the composer already accepts.
function setFilters(dict) {
  filterModel.value.params.filters = dict || {}
  const pred = filtersToPredicate(dict)
  activeFilters.value = pred
    ? pred.conditions.map((c) => [c.field, c.operator, c.value])
    : []
}

// SortBy emit is an order_by string ("field dir, …"); the composer takes a single [field, dir].
function setSort(orderBy) {
  // Written back like the filters: SortBy renders its whole control off `params.order_by` (SortBy.vue:203).
  sortModel.value.params.order_by = orderBy || ''
  const first = (orderBy || '').split(',')[0].trim()
  sort.value = first ? first.split(' ') : null
}

function onFilterUpdate(dict) {
  setFilters(dict)
  persistState()
  fetchRows()
}

function onSortUpdate(orderBy) {
  setSort(orderBy)
  persistState()
  fetchRows()
}

// A preset a PERSON clicked becomes their state; one replayed by a recall or a drill does not.
function onPresetApply(preset) {
  applyPreset(preset)
  persistState()
}

// A preset replays through the same two setters a click uses, then fetches once.
function applyPreset({ filters, sort: orderBy }) {
  setFilters(filters || {})
  setSort(orderBy || '')
  fetchRows()
}

function getParams() {
  return {
    view: myView.value,
    search: search.value || undefined,
    sort: sort.value ? JSON.stringify(sort.value) : undefined,
    filters: activeFilters.value.length
      ? JSON.stringify(activeFilters.value)
      : undefined,
    page_size: pageLength.value,
  }
}

// The data source, cached by view and refetched on mount, as the native list does.
const list = createResource({
  url: 'tatva_connect.smartview.api.get_data',
  params: getParams(),
  cache: ['smart-view-rows', props.viewName],
})

// DENIED is the server's PermissionError; FAILED is everything else.
const denied = computed(() => list.error?.exc_type === 'PermissionError')
const failed = computed(() => !!list.error && !denied.value)
const loading = computed(() => list.loading)

// A stable reactive array frappe-ui resizes in place, rebuilt only when the column set changes so a reload never resets a dragged width.
const columns = ref([])
watch(
  // Watched by value: the column set plus saved widths, which can arrive after the first page of data.
  () =>
    [
      (list.data?.columns || []).map((c) => c.key).join('|'),
      JSON.stringify(viewMeta.value.column_widths || {}),
    ].join('::'),
  () => {
    const cols = list.data?.columns || []
    const saved = viewMeta.value.column_widths || {}
    columns.value = cols.map((c, i) => ({
      key: c.key,
      label: c.label,
      type: c.fieldtype,
      fieldname: c.fieldname,
      options: c.options,
      // The server names the one column that identifies the row; only it draws the person chip.
      identity: Boolean(c.identity),
      align: alignFor(c.fieldtype),
      // A remembered width wins; anything unremembered falls back to what its fieldtype implies.
      width: saved[c.key] || widthFor(c.fieldtype, i === 0),
    }))
  },
  { immediate: true },
)
// Bound to the resource, never a copy made in a success callback a cache hit would skip (C.4).
const rows = computed(() => list.data?.rows || [])
const total = computed(() => list.data?.total || 0)

// The shape linkTargetDoctype reads; frozen so every cell is handed the same object, not a new one.
const LEAD_REF = Object.freeze({
  key: 'name',
  type: 'Link',
  options: 'CRM Lead',
})

// `_assign` is a JSON array of user ids, parsed in the cell like every other value.
const assigneeCache = new Map()

function assignees(value) {
  // Memoised on the raw cell, so a re-render neither re-parses nor hands MultipleAvatar a new array.
  if (assigneeCache.has(value)) return assigneeCache.get(value)
  const out = buildAssignees(value)
  assigneeCache.set(value, out)
  return out
}

function buildAssignees(value) {
  let users
  try {
    users = JSON.parse(value || '[]')
  } catch {
    users = [] // a malformed cell must not take the row down
  }
  return users.map((user) => ({
    name: user,
    image: getUser(user).user_image,
    label: getUser(user).full_name,
  }))
}

// Links read their title via `linkTitle.js` (Users via the users store); numbers format via the native helpers, handed a one-field doc under the real `fieldname`.
const NUMERIC_FORMAT = {
  Currency: getFormattedCurrency,
  Float: getFormattedFloat,
  Percent: getFormattedPercent,
}

function cellText(row, column) {
  const value = row[column.key]
  if (value === null || value === undefined || value === '') return ''
  if (column.type === 'Link') {
    if (column.options === 'User') return getUser(value)?.full_name || value
    return formatCell(linkTitleFor(column.options, value, list) || value, column.type)
  }
  const numeric = NUMERIC_FORMAT[column.type]
  if (numeric && column.fieldname) return numeric(column.fieldname, { [column.fieldname]: value })
  return formatCell(value, column.type)
}

// The view's lazy tab count, pushed when a response lands; a narrowed (search/filter) response must not rewrite it.
watch(
  () => list.data,
  (d) => {
    if (!d || d.total == null || narrowed.value) return
    store.setCount(myView.value, d.total)
  },
  { immediate: true },
)

// ---- bulk actions: the native pipeline; ListBulkActions reads `.data` and calls `.reload()` when an action completes ----
const listBulkActionsRef = ref(null)
const bulkList = computed(() => ({ data: list.data, reload: fetchRows }))
const bulkOptions = computed(() =>
  props.baseObject === 'Lead' ? { hideConvert: true } : { hideAssign: true },
)

// A changed question always asks: one get_data in flight, and every change meanwhile collapses into one follow-up on the latest params.
const reloadRows = coalescedReload(list)
function fetchRows() {
  list.params = getParams()
  return reloadRows()
}

// Refresh and Retry, with the native list's mid-load guard.
function reload() {
  if (list.loading) return
  fetchRows()
}

// Saves widths once per drag (debounced), only when the caller can write the view; otherwise the width lasts the session.
const persistWidths = useDebounceFn(() => {
  if (!props.canEdit) return
  const widths = {}
  for (const c of columns.value) if (c.width) widths[c.key] = String(c.width)
  call('tatva_connect.smartview.api.set_column_widths', {
    view: myView.value,
    widths: JSON.stringify(widths),
  }).catch(() => {}) // a preference that fails to save must never interrupt reading the list
}, 600)

function onColumnWidth() {
  persistWidths()
}

// ---- share + export: behind the `…` menu, absent rather than disabled when the caller may not use them ----
const showExport = ref(false)
const showShare = ref(false)
// The shared queued-export lifecycle; `preparing` drives the button while a worker builds the file.
const exportJob = useExportJob()

// The same permission the export enforces, asked once per base object (cached, not `auto`) so the item can be left out.
const exportAllowed = createResource({
  url: 'tatva_connect.smartview.api.can_export',
  cache: ['smart-view-can-export', props.baseObject],
  makeParams: () => ({ base_object: props.baseObject }),
  // A probe must not throw: a failure just leaves the Export item absent.
  onError: () => {},
})

const menuItems = computed(() => {
  const items = []
  if (props.canEdit && !isMobileView.value) {
    items.push({
      label: __('Edit view'),
      icon: () => h(EditIcon, { class: 'h-4 w-4' }),
      onClick: () => emit('editView'),
    })
    items.push({
      label: __('Share'),
      icon: () => h(FeatherIcon, { name: 'share-2', class: 'h-4 w-4' }),
      onClick: () => (showShare.value = true),
    })
  }
  if (exportAllowed.data) {
    items.push({
      label: __('Export'),
      icon: () => h(ExportIcon, { class: 'h-4 w-4' }),
      onClick: () => (showExport.value = true),
    })
  }
  return items
})

// `xlsx`/`csv` is the Smart View producer's own vocabulary, so the mapping lives at the call.
const VIEW_FORMAT = { excel: 'xlsx', csv: 'csv' }

// Queues the export with the on-screen search/sort/filters; a worker builds the file and `useExportJob` saves it when ready.
async function download({ format, all }) {
  const queued = await call('tatva_connect.smartview.api.export_view', {
    view: myView.value,
    fmt: VIEW_FORMAT[format],
    search: search.value || null,
    sort: sort.value ? JSON.stringify(sort.value) : null,
    filters: activeFilters.value.length
      ? JSON.stringify(activeFilters.value)
      : null,
    // What the reader is looking at; asking for everything omits it and the ceiling is the only bound.
    limit: all ? null : rows.value.length,
  })
  // Closed after queueing, so "Preparing…" covers the round trip and a second click cannot queue twice.
  exportJob.track(queued)
  showExport.value = false
}

const onSearch = useDebounceFn(() => fetchRows(), 300)

// Mobile search opens over the row and closes when empty; closing clears, so a hidden search never filters the list.
const searchOpen = ref(false)
const searchInput = ref(null)
function openSearch() {
  searchOpen.value = true
  nextTick(() => searchInput.value?.$el?.querySelector('input')?.focus())
}
function closeSearch() {
  const had = !!search.value
  search.value = ''
  searchOpen.value = false
  if (had) fetchRows()
}
function onSearchBlur() {
  if (!search.value) searchOpen.value = false
}

// The native list's `updatePageLength`: refused mid-load before anything changes, so no rows are skipped.
function updatePageLength(value, loadMore = false) {
  if (list.loading) return
  if (loadMore) {
    pageLength.value += pageLengthCount.value
  } else {
    if (value == pageLength.value && value == pageLengthCount.value) return
    pageLength.value = value
    pageLengthCount.value = value
  }
  fetchRows()
}

// A refresh reopens the question, through `applyPreset` so recall and a click are one path and one fetch.
function recallState() {
  call('tatva_connect.presets.current', {
    reference_doctype: 'CRM Smart View',
    reference_name: myView.value,
  })
    .then((row) =>
      applyPreset({
        filters: row?.filters ? JSON.parse(row.filters) : {},
        sort: row?.sort ? JSON.parse(row.sort) : '',
      }),
    )
    .catch(() => fetchRows()) // a remembered question that cannot be read is not a reason to show nothing
}

// Debounced and failure-silent, the shape `persistWidths` uses — a preference never interrupts reading.
const persistState = useDebounceFn(() => {
  call('tatva_connect.presets.remember_current', {
    reference_doctype: 'CRM Smart View',
    reference_name: myView.value,
    filters: JSON.stringify(filterModel.value.params.filters || {}),
    sort: JSON.stringify(sortModel.value.params.order_by || ''),
  }).catch(() => {})
}, 600)

// onActivated, not onMounted: this list is KeepAlive'd, so returning to a tab never mounts again.
onActivated(() => {
  const arrived = readArrival(route.query)
  if (!arrived) return
  dropArrival(route, router)
  // A preset defines the WHOLE state, so an absent half is an empty one, not a half left standing.
  applyPreset({ filters: arrived.filters || {}, sort: arrived.sort })
})

// A saved definition can change the fields and the columns, so both are asked again.
watch(() => props.revision, () => {
  catalog.reload()
  fetchRows()
})

onMounted(() => {
  // Always, like the native list — unless an arrival is about to ask its own question, which would make this the first of two fetches.
  if (!readArrival(route.query)) recallState()
  // Fetch only what has never answered; on a return visit both are cached, so only the rows are requested.
  if (!catalog.data && !catalog.loading) catalog.fetch()
  if (exportAllowed.data == null && !exportAllowed.loading) exportAllowed.fetch()
})

// Lead rows open the Lead page and activity rows the task modal; the parent owns both.
function openRow(row) {
  if (!row?.name) return
  if (props.baseObject === 'Lead') emit('openLead', row.name)
  else emit('openTask', row.name)
}

defineExpose({ fetchRows })
</script>
