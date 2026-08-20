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
  never copy into local refs, so there is one source of truth for what is on screen. The view's `total`
  is pushed to the store as its lazy count (§6) whenever data lands. Read-only.

  The rows are cached by view and refetched on mount, the native list's pairing. A fact about a THING
  rather than about this mount (the field catalog, the export permission) is cached by that thing.
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
        <!-- The native list's own refresh, same shape as ViewControls.vue: same icon, same tooltip, and
             `loading` bound so the button shows the fetch rather than a second spinner elsewhere. It
             re-runs the SAME query with the SAME params through the SAME cache key — never a second
             code path, so a refresh and a filter change cost identically. -->
        <Button
          :tooltip="__('Refresh')"
          :icon="RefreshIcon"
          :loading="loading"
          @click="reload"
        />
        <template v-if="catalogReady">
          <!-- H5: on a phone these collapse to their icons — `hideLabel` is the prop both controls
               already carry for exactly this, so the toolbar never wraps under the search box. -->
          <Filter
            v-model="filterModel"
            :doctype="drivingDoctype"
            :fields="filterFields"
            :hideLabel="isMobileView"
            @update="onFilterUpdate"
          />
          <SortBy
            v-model="sortModel"
            :doctype="drivingDoctype"
            :fields="sortFields"
            :hideLabel="isMobileView"
            @update="onSortUpdate"
          />
        </template>
        <!-- Every VIEW-LEVEL action lives behind the `…` menu — edit, share, export — which is where
             ViewControls.vue puts Export on a native list. The controls left on the bar (search, filter,
             sort, refresh) change what you are LOOKING at; these change the view itself. An item is
             ABSENT rather than disabled when its permission is missing. -->
        <!-- Same button and same placement as the native list's overflow (ViewControls.vue:216,225): default variant, not ghost, or it reads flatter than every other control on this bar. -->
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
    </div>

    <!-- The app's own indicator, not a bare word: every other surface waits with this shape. -->
    <div
      v-if="loading && !rows.length"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-ink-gray-5"
    >
      <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
      <span>{{ __('Loading…') }}</span>
    </div>
    <!-- The verdict vocabulary (SV-03): DENIED is only what the server called a PermissionError; every
         other failure is FAILED and offers a way out. One sentence for both is how a timeout got read
         as "you have no access" — the editor's four-state shape, promoted here. -->
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
      :rows="displayRows"
      row-key="name"
      :options="{
        onRowClick: openRow,
        selectable: false,
        showTooltip: true,
        resizeColumn: true,
        emptyState: { title: emptyTitle, description: emptyDescription },
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
        class="mx-3 sm:mx-5"
        :rows="displayRows"
        :doctype="drivingDoctype"
      >
        <ListRowItem :item="item" class="overflow-hidden">
          <template #default="{ label }">
            <!-- A Lead view's row IS the lead, so its identity cell is the same person chip the native lists draw.
                 An Activity view's name is a snapshot and stays text. -->
            <LeadCell
              v-if="isLeadIdentity(column)"
              :value="row.name"
              :column="LEAD_REF"
              :row="row"
              :list="list"
            />
            <!-- Select / status-like Link render as a subtle pill (LSQ-style), like the native lists. -->
            <Badge
              v-else-if="isPill(column) && label"
              variant="subtle"
              size="md"
              :theme="pillTheme(label)"
              :label="label"
              class="max-w-full"
            />
            <div v-else class="truncate text-base">{{ label }}</div>
          </template>
        </ListRowItem>
      </ListRows>
    </ListView>

    <ResponsiveDialog
      v-model="showExport"
      :options="{
        title: __('Export'),
        actions: [
          {
            label: exportJob.preparing ? __('Preparing…') : __('Download'),
            variant: 'solid',
            // A worker is already draining one; a second click would queue a second job for the same file.
            disabled: exportJob.preparing,
            onClick: () => download(),
          },
        ],
      }"
    >
      <template #body-content>
        <FormControl
          v-model="exportFormat"
          type="select"
          variant="outline"
          :label="__('Export type')"
          :options="[
            { label: __('Excel'), value: 'xlsx' },
            { label: __('CSV'), value: 'csv' },
          ]"
        />
        <p class="mt-3 text-p-sm text-ink-gray-5">
          {{
            __(
              'Downloads this view exactly as it is on screen — the same columns, the same filters, and only the rows you can see.',
            )
          }}
        </p>
      </template>
    </ResponsiveDialog>

    <SmartViewShareDialog
      v-if="showShare"
      v-model="showShare"
      :viewName="viewName"
      :isStandard="Boolean(viewMeta.is_standard)"
      @changed="emit('sharingChanged')"
    />

    <!-- The Leads paging contract (C1-C7): the footer's v-model is the page SIZE, Load More widens the
         window. At the server's PAGE_MAX the window can grow no further, so the Load More half retires
         and says why — through ListFooter's OWN `right` slot (G6: a slot for variation, not a second
         footer), which keeps the page-size buttons reachable instead of hiding the control that would
         let the reader narrow their way out (SV-13/14). -->
    <ListFooter
      v-if="!denied && !failed && rows.length"
      v-model="pageLength"
      class="border-t border-outline-gray-1 px-3 py-2 sm:px-5"
      :options="{ rowCount: rows.length, totalCount: total }"
      @loadMore="loadMore"
    >
      <template v-if="atServerCap" #right>
        <div class="text-base text-ink-gray-5">
          {{
            __('{0} of {1} — narrow with a search or filter to see the rest.', [
              rows.length,
              total,
            ])
          }}
        </div>
      </template>
    </ListFooter>
  </div>
</template>

<script setup>
import {
  Badge,
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
import RefreshIcon from '@/components/Icons/RefreshIcon.vue'
import ExportIcon from '@/components/Icons/ExportIcon.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import SmartViewShareDialog from '@/tatva/SmartViewShareDialog.vue'
import { useExportJob } from '@/tatva/useExportJob'
import ListRows from '@/components/ListViews/ListRows.vue'
import LeadCell from '@/tatva/LeadCell.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import Filter from '@/components/Filter.vue'
import SortBy from '@/components/SortBy.vue'
import { widthFor, formatCell, isPill, pillTheme } from '@/tatva/listColumns'
import { computed, h, ref, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { isMobileView } from '@/composables/settings'
import { smartViewsStore } from '@/stores/smartViews'
import { filtersToPredicate } from '@/tatva/smartViewPredicate'

const props = defineProps({
  // The CRM Smart View `name` (the doctype row name), driving get_data.
  viewName: { type: String, required: true },
  baseObject: { type: String, default: 'Lead' },
  // Whether the caller may edit this view (shows the Edit-view entry point).
  canEdit: { type: Boolean, default: false },
})
const emit = defineEmits(['openLead', 'openTask', 'editView', 'sharingChanged'])

const store = smartViewsStore()

const search = ref('')
const sort = ref(null) // [field_key, 'asc'|'desc']
// The Leads contract, two DISTINCT params (ViewControls.vue:1052-1070): pageLength is the page SIZE
// (the footer's v-model), pageLimit is the current WINDOW — Load More refetches 0..N with a bigger
// limit. One ref doing both jobs is why the size buttons changed nothing (SV-13/14).
const pageLength = ref(50)
const pageLimit = ref(50)
// The server refuses to hand more than this in one window (smartview/api.py PAGE_MAX) — mirrored so
// the Load More affordance retires honestly instead of being offered and doing nothing.
const PAGE_MAX = 200
// A COMPUTED, not a setup snapshot: `activeView` can change without a route change on the param-less
// /crm/smart-views URL (deleting the first view), and the page only remounts on a route change.
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

// ---- interactive filter / sort (native primitives fed by the catalog) ----------
// Columns are NOT interactive here: a Smart View IS its curated column set, declared once in the editor.
// A second picker on the toolbar was a rival curation that never persisted. Filter/Sort stay transient.
const viewMeta = computed(() => store.getView(myView.value) || {})
// Cached by the THING (B2) and NOT `auto` (SV-15). Both halves are needed: the cache key makes the
// answer a fact about (base_object, activity_type) so a remount paints it on the first frame, and
// dropping `auto` is what stops the request — frappe-ui reloads a cached resource on every
// re-creation (resources.js:16-18), so `auto` alone would have kept one round trip per tab click.
// The single fetch is triggered on mount behind the A6 guard.
const catalog = createResource({
  url: 'tatva_connect.smartview.api.field_catalog',
  cache: [
    'smart-view-catalog',
    props.baseObject,
    viewMeta.value?.activity_type || '',
  ],
  makeParams: () => ({
    base_object: props.baseObject,
    activity_type:
      props.baseObject === 'Activity'
        ? viewMeta.value.activity_type || undefined
        : undefined,
  }),
})
const catalogReady = computed(
  () => Array.isArray(catalog.data) && catalog.data.length > 0,
)
// `link_query` and `grain_options` ride along: a view names this column `lead:program`, so its scoping travels with the field or this surface offers the whole master.
const toField = (c) => ({
  fieldname: c.field_key,
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
  activeFilters.value = pred
    ? pred.conditions.map((c) => [c.field, c.operator, c.value])
    : []
  restart()
}

// SortBy emit is an order_by string ("field dir, …"); the composer takes a single [field, dir].
function onSortUpdate(orderBy) {
  const first = (orderBy || '').split(',')[0].trim()
  sort.value = first ? first.split(' ') : null
  restart()
}

const countNeeded = ref(true)

function getParams() {
  return {
    view: myView.value,
    search: search.value || undefined,
    sort: sort.value ? JSON.stringify(sort.value) : undefined,
    filters: activeFilters.value.length
      ? JSON.stringify(activeFilters.value)
      : undefined,
    page_size: pageLimit.value,
    with_count: countNeeded.value ? 1 : 0,
  }
}

// The data source, cached by view and refetched on mount — the native list's own pairing (ViewControls.vue:544,582). Keyed on the view, so B1 holds: a new view is a new instance.
const list = createResource({
  url: 'tatva_connect.smartview.api.get_data',
  params: getParams(),
  cache: ['smart-view-rows', props.viewName],
})

// DENIED is the server's own word (frappeRequest.js:82 carries exc_type); FAILED is everything else.
const denied = computed(() => list.error?.exc_type === 'PermissionError')
const failed = computed(() => !!list.error && !denied.value)
const loading = computed(() => list.loading)
const atServerCap = computed(
  () => pageLimit.value >= PAGE_MAX && total.value > rows.value.length,
)

// Columns are a STABLE reactive array, not a per-reload computed — exactly how the native Leads list works
// (it hands frappe-ui the same reactive objects on list.data.columns). frappe-ui mutates `column.width` on
// every mousemove during a drag; because these objects stay reactive and stable, the grid resizes live and
// the width holds for the session. Rebuilt only when the column SET changes (not on a data reload), so a
// search/sort/paginate never snaps a dragged width back to the fieldtype default.
const columns = ref([])
watch(
  // Watched as VALUES, not identities (E1): the column SET, and the remembered widths serialised. The
  // widths arrive from the tabs store, which can land AFTER the first page of data — keyed on the set
  // alone the grid would paint at default widths and never pick the saved ones up.
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
      // A remembered width wins; anything unremembered falls back to what its fieldtype implies.
      width: saved[c.key] || widthFor(c.fieldtype, i === 0),
    }))
  },
  { immediate: true },
)
const rows = computed(() => list.data?.rows || [])
// Load More asks for no count (widening the window cannot change what MATCHED), so the last one is kept.
const lastTotal = ref(0)
const total = computed(() => lastTotal.value)

// The shape linkTargetDoctype reads; frozen so every cell is handed the same object, not a new one.
const LEAD_REF = Object.freeze({
  key: 'name',
  type: 'Link',
  options: 'CRM Lead',
})

// Only a Lead view, and only its first column — that is the one cell that identifies the row.
function isLeadIdentity(column) {
  return props.baseObject === 'Lead' && column.key === columns.value[0]?.key
}

// Display prefers the server's `<key>_label` (a Link holds a composite key); the key itself is never overwritten.
const displayRows = computed(() =>
  rows.value.map((r) => {
    const o = { name: r.name }
    for (const c of columns.value) {
      const shown = r[`${c.key}_label`] ?? r[c.key]
      o[c.key] = formatCell(shown, c.type)
    }
    return o
  }),
)

// §6 lazy count: push this view's total whenever data lands — never before load.
watch(
  () => list.data,
  (d) => {
    if (!d) return
    // `total` is null when the count was skipped; the previous one still stands.
    if (d.total !== null && d.total !== undefined)
      lastTotal.value = Number(d.total) || 0
    // The badge is a fact about the VIEW, so a transient search/filter must not rewrite it — it read 0 on a 17-row view.
    if (narrowed.value) return
    store.setCount(myView.value, lastTotal.value)
  },
  { immediate: true },
)

function reload() {
  list.params = getParams()
  // The verdict renders from list.error; frappe-ui rethrows even with onError (resources.js:172), so
  // uncaught this was an unhandled rejection on every failure.
  return list.reload().catch(() => {})
}

// A new search, filter, sort or size RESTARTS at the first window (C6) — a new question, not "more".
function restart() {
  pageLimit.value = pageLength.value
  countNeeded.value = true // a new question is a new count
  reload()
}

// The footer's v-model is the page SIZE (ListFooter.vue:49): picking 20/50/100 resets the window to
// one page of that size and refetches — the watcher the old single-ref shape never had (SV-13).
watch(pageLength, () => restart())

// The grid mutates `column.width` live on every mousemove; this fires when a drag ENDS. Debounced so a
// single drag is one write, and skipped when the caller cannot write the view — a rep dragging a shared
// view keeps the width for their session rather than being shown an error for resizing a column.
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

// ---- share + export -------------------------------------------------------------
// Both sit behind the `…` menu, and an item is ABSENT rather than disabled when the caller may not use
// it: a control that is offered and then refuses is worse than one that was never there.
const showExport = ref(false)
const showShare = ref(false)
const exportFormat = ref('xlsx')
// One owner of the queued-export lifecycle (progress, ready, failed), shared with every other surface
// that downloads. `preparing` is what the button reads while a worker is draining.
const exportJob = useExportJob()

// The SAME native permission the export itself enforces, asked once so the item can be left out.
// Cached by base_object and NOT `auto`, for the same reason as the catalog: one request per session,
// then every later tab click reads the answer off the cache with no round trip.
const exportAllowed = createResource({
  url: 'tatva_connect.smartview.api.can_export',
  cache: ['smart-view-can-export', props.baseObject],
  makeParams: () => ({ base_object: props.baseObject }),
  // A PROBE MUST NOT THROW. This only decides whether an Export item is drawn, so a failure is not the
  // list's problem — it answers "no" and the item is absent. Without this the rejection was unhandled:
  // it escaped the component, and in CI seven of them leaked out of this file and failed an unrelated
  // suite. An optional affordance may never destabilise the thing it sits on.
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

// The endpoint QUEUES and answers at once; a worker builds the file and `useExportJob` saves it when
// the socket says it is ready. It used to be a `window.location.href` to the same method, which meant the
// browser sat on the request while 5,000 rows were assembled — and showed the gateway's 504 page when
// that outlived the timeout. The SAME search/sort/filters the screen is showing are still sent, because
// the download IS the screen; only who waits for it changed.
async function download() {
  const queued = await call('tatva_connect.smartview.api.export_view', {
    view: myView.value,
    fmt: exportFormat.value,
    search: search.value || null,
    sort: sort.value ? JSON.stringify(sort.value) : null,
    filters: activeFilters.value.length
      ? JSON.stringify(activeFilters.value)
      : null,
  })
  // Closed AFTER the queue, so the button's own "Preparing…" state is real for the round trip and a
  // second click cannot queue the same file twice.
  exportJob.track(queued)
  showExport.value = false
}

const onSearch = useDebounceFn(() => restart(), 300)

// Load More widens the window by one page (the Leads shape: refetch 0..N, never a cursor), capped at
// the server's own ceiling so the request never asks for what the composer will refuse.
function loadMore() {
  pageLimit.value = Math.min(pageLimit.value + pageLength.value, PAGE_MAX)
  countNeeded.value = false
  reload()
}

onMounted(() => {
  // Always, like the native list: guarding it left filtered rows under an empty toolbar for the whole visit.
  reload()
  // A6: fetch only what has never answered. On a return visit to any tab both of these are already in
  // the frappe-ui cache, so the click costs exactly ONE request — the rows — and nothing else.
  if (!catalog.data && !catalog.loading) catalog.fetch()
  if (!exportAllowed.data && !exportAllowed.loading) exportAllowed.fetch()
})

// Read-only navigation. Lead view rows ARE leads -> the Lead page; activity rows ARE CRM Tasks ->
// the native task/activity modal (the parent owns the modal mount). row.name is the driving doc name.
function openRow(row) {
  if (!row?.name) return
  if (props.baseObject === 'Lead') emit('openLead', row.name)
  else emit('openTask', row.name)
}

defineExpose({ reload })
</script>
