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

  State is COMPUTED, never copied in a success callback (which a cache hit would skip): columns read
  `list.data` directly, and rows read the page accumulator that the one `list.data` watcher fills. The
  accumulator exists because Load More fetches the NEXT page rather than re-fetching a wider window, so
  the rows on screen are more than one response; every page files itself under the page number the
  response names. The view's `total` is pushed to the store as its lazy count (§6). Read-only.

  The rows are cached by view and refetched on mount, the native list's pairing. A fact about a THING
  rather than about this mount (the field catalog, the export permission) is cached by that thing.
-->
<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Toolbar — the native list shape (see ViewControls.vue): ONE row, search left, the
         interactive controls grouped right-aligned. Never wraps into a vertical stack.
         `py-4` is ViewControls' own vertical rhythm, measured off the leads list (its control row is
         68px: a 36px control between 16px above and below). This row carried `py-2`, so the switcher
         above it, the search, and the list header below were packed into half that air and the surface
         read denser than every other list. Flat, not breakpoint-scoped, exactly as ViewControls has it,
         so phone and desktop breathe the same. The horizontal gutter and the footer already matched. -->
    <div class="flex shrink-0 items-center gap-2 px-3 py-4 sm:px-5">
      <!-- Mobile: an OPEN search takes over the whole row so its placeholder is never clipped and the
           control cluster cannot crowd it — the shape ActivityHeader.vue:6-20 already uses on the lead
           detail tabs. Closed, it collapses to an icon beside the other secondary controls, which is
           what `hideLabel` does for Filter/Sort/Presets on the same row. -->
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
          <!-- A saved filter combination is a fact about THIS view, so the view is the surface it hangs off. -->
          <FilterPresets
            :referenceDoctype="'CRM Smart View'"
            :referenceName="myView"
            :filters="filterModel.params.filters"
            :sort="sortModel.params.order_by"
            :hideLabel="isMobileView"
            @apply="applyPreset"
          />
          <!-- Guarded on the FIELDS each control actually reads, not on the catalog's length: both fall back
               to their own doctype-meta fetch when handed an empty list (Filter.vue:224, SortBy.vue:192),
               which costs a request and offers the whole ungrained CRM Lead field set — which the server
               then refuses. `filterable` is a per-row flag, so a catalog with none is reachable. -->
          <template v-if="filterFields.length">
            <!-- H5: on a phone these collapse to their icons — `hideLabel` is the prop both controls
                 already carry for exactly this, so the toolbar never wraps under the search box. -->
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
      :rows="rows"
      row-key="name"
      :options="{
        onRowClick: openRow,
        selectable: true,
        // The native lists pass false (Leads.vue:239) and so must this one: ListRowItem tooltips the RAW
        // item, so a Link cell showed its resolved title and tooltipped the composite `v::g::p::name` PK —
        // the exact string `linkTitle.js` exists to keep off the screen — and a date tooltipped raw ISO.
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
            <!-- The one column the server named as the row's identity, drawn the way every other listing draws it. -->
            <LeadCell
              v-if="column.identity"
              :value="row.name"
              :column="LEAD_REF"
              :row="row"
              :list="titleSource"
            />
            <!-- Assignees are avatars, drawn the way every native list draws them (Leads.vue:184). -->
            <div
              v-else-if="column.fieldname === '_assign'"
              class="flex items-center truncate"
            >
              <MultipleAvatar :avatars="assignees(row[column.key])" size="sm" />
            </div>
            <!-- A Check is the native disabled checkbox and a Rating the native control, exactly as
                 LeadsListView draws them — a glyph and a bare number were a parallel rendering. -->
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

    <!-- Lead rows are CRM Leads and Activity rows are CRM Tasks, so the driving doctype IS the target.
         The Activity options are byte-identical to TasksListView.vue's; Convert belongs to the leads list. -->
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

const props = defineProps({
  // The CRM Smart View `name` (the doctype row name), driving get_data.
  viewName: { type: String, required: true },
  baseObject: { type: String, default: 'Lead' },
  // Whether the caller may edit this view (shows the Edit-view entry point).
  canEdit: { type: Boolean, default: false },
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
// pageLength is the page SIZE (the footer's v-model); `page` is the page being fetched.
const pageLength = ref(50)
const page = ref(1)
// The pages fetched so far as [{rows, titles}] — titles ride along or page 1's chips lose their names.
const pages = ref([])
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
  // The grain is in the key as well as the params: two views of one base object resolve different fields,
  // so a shared key would serve one view's picker out of another view's catalog.
  cache: [
    'smart-view-catalog',
    props.baseObject,
    viewMeta.value?.activity_type || '',
    viewMeta.value?.vertical || '',
    viewMeta.value?.group || '',
    viewMeta.value?.program || '',
  ],
  makeParams: () => ({
    base_object: props.baseObject,
    activity_type:
      props.baseObject === 'Activity'
        ? viewMeta.value.activity_type || undefined
        : undefined,
    // Scoped to THIS view, or the picker offers a field `get_data` will refuse to resolve.
    vertical: viewMeta.value?.vertical || undefined,
    group: viewMeta.value?.group || undefined,
    program: viewMeta.value?.program || undefined,
  }),
})
// `link_query` and `grain_options` ride along: a view names this column `lead:program`, so its scoping travels with the field or this surface offers the whole master.
const toField = (c) => ({
  fieldname: c.field_key,
  // `value` AS WELL AS `fieldname`, and it is not redundant. Autocomplete resolves a string-valued
  // selection back to its label by matching `option.value` (Autocomplete.vue:259-265); with only a
  // `fieldname` there is no match and it falls back to printing the string. On a native list that string
  // is `first_name` and nobody notices — ours is `acq:utm_disease`, so the picker searched by label and
  // then displayed the raw key. The control documents this shape; we were handing it an incomplete one.
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

// Setting the state and FETCHING are separate, because a preset sets both halves and must still cost one
// request. Each half is derived in exactly one place, whether a person clicked it or a preset replayed it.

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
  restart()
}

function onSortUpdate(orderBy) {
  setSort(orderBy)
  restart()
}

// A preset replays through the SAME two setters a person's own clicks go through — one derivation, one
// fetch, and the toolbar controls repaint from the models they already read.
function applyPreset({ filters, sort: orderBy }) {
  setFilters(filters || {})
  setSort(orderBy || '')
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
    page: page.value,
    page_size: pageLength.value,
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
// A computed off the accumulator, never a copy made in a success callback a cache hit would skip (C.4).
const rows = computed(() => pages.value.flatMap((p) => p?.rows || []))
// LeadCell reads `_link_titles` off a list-shaped object; this is every loaded page's map, merged.
const titleSource = computed(() => ({
  data: { _link_titles: Object.assign({}, ...pages.value.map((p) => p?.titles || {})) },
}))
// Load More asks for no count (another page cannot change what MATCHED), so the last one is kept.
const lastTotal = ref(0)
const total = computed(() => lastTotal.value)

// The shape linkTargetDoctype reads; frozen so every cell is handed the same object, not a new one.
const LEAD_REF = Object.freeze({
  key: 'name',
  type: 'Link',
  options: 'CRM Lead',
})

// Formatted in the CELL, like the native lists — a second row array recomputed every column x row was
// a copy of the resource's own rows.
// `_assign` is a JSON array of user ids on the row — parsed in the CELL, exactly as the native list does.
const assigneeCache = new Map()

function assignees(value) {
  // Memoised on the raw cell: this is called from the template, so without it every re-render re-parsed
  // the JSON and re-read the users store for every visible row, and handed MultipleAvatar a new array
  // each time. The native list parses once, in its rows computed (Leads.vue:480).
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

// A Link's title comes out of `_link_titles` through `linkTitle.js`, the ONE reader every list in the app
// shares — the row keeps the composite key, which is what the view filters and sorts by. A User is the
// exception the framework itself makes: it declares no `show_title_field_in_link`, so the map skips it
// and every surface reads the name off the users store instead (Leads.vue:478).
// A measurement is formatted by the doctype's own precision and the site's currency, through the same
// three helpers the native list uses (Leads.vue:426-437). The row is keyed by field_key, so the helper is
// handed a one-field doc under the column's real `fieldname` — which the payload now carries.
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
    return formatCell(linkTitleFor(column.options, value, titleSource.value) || value, column.type)
  }
  const numeric = NUMERIC_FORMAT[column.type]
  if (numeric && column.fieldname) return numeric(column.fieldname, { [column.fieldname]: value })
  return formatCell(value, column.type)
}

// ONE watcher for ONE event — a page landed: file it, and push the view's §6 lazy count.
watch(
  () => list.data,
  (d) => {
    if (!d) return
    // Filed at the index the RESPONSE names, and never ABOVE the page we have actually asked for. The
    // resource persists its last payload (frappe-ui writes it to IndexedDB), so a view left on page 3 last
    // session hands that page back while page 1 is still in flight — filed blind, the list showed page 3's
    // rows under the current filters until the next restart, and pushed its count to the tab badge.
    const landed = d.page || 1
    if (landed > page.value) return
    pages.value[landed - 1] = { rows: d.rows || [], titles: d._link_titles || {} }
    // `total` is null when the count was skipped; the previous one still stands.
    if (d.total !== null && d.total !== undefined)
      lastTotal.value = Number(d.total) || 0
    // The badge is a fact about the VIEW, so a transient search/filter must not rewrite it — it read 0 on a 17-row view.
    if (narrowed.value) return
    store.setCount(myView.value, lastTotal.value)
  },
  { immediate: true },
)

// ---- bulk actions (the native pipeline, unchanged) --------------------------------
// ListBulkActions reads `.data` (for list scripts) and calls `.reload()` when an action completes. A
// mutation invalidates every page loaded so far, so its reload is `restart`, not a refetch of one page.
const listBulkActionsRef = ref(null)
const bulkList = computed(() => ({ data: list.data, reload: restart }))
const bulkOptions = computed(() =>
  props.baseObject === 'Lead' ? { hideConvert: true } : { hideAssign: true },
)

function reload() {
  // The native list's own guard (ViewControls.vue:588): a filter change followed quickly by Load More,
  // or a Refresh mid-load, otherwise issues overlapping get_data calls on one shared resource.
  if (list.loading) return Promise.resolve()
  list.params = getParams()
  // The verdict renders from list.error; frappe-ui rethrows even with onError (resources.js:172), so
  // uncaught this was an unhandled rejection on every failure.
  return list.reload().catch(() => {})
}

// A new search, filter, sort or size RESTARTS at the first page (C6) — a new question, not "more".
function restart() {
  page.value = 1
  pages.value = []
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

// `xlsx`/`csv` is the Smart View producer's own vocabulary, so the mapping lives at the call.
const VIEW_FORMAT = { excel: 'xlsx', csv: 'csv' }

// The endpoint QUEUES and answers at once; a worker builds the file and `useExportJob` saves it when
// the socket says it is ready. It used to be a `window.location.href` to the same method, which meant the
// browser sat on the request while 5,000 rows were assembled — and showed the gateway's 504 page when
// that outlived the timeout. The SAME search/sort/filters the screen is showing are still sent, because
// the download IS the screen; only who waits for it changed.
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
  // Closed AFTER the queue, so the button's own "Preparing…" state is real for the round trip and a
  // second click cannot queue the same file twice.
  exportJob.track(queued)
  showExport.value = false
}

const onSearch = useDebounceFn(() => restart(), 300)

// Mobile search opens over the row and closes when it is empty — ActivityHeader.vue:222-234, the shape
// the lead detail tabs already use. Closing CLEARS, because a hidden search box still filtering the list
// is a list the reader cannot explain.
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
  if (had) restart()
}
function onSearchBlur() {
  if (!search.value) searchOpen.value = false
}

// Load More fetches the NEXT page: page 40 costs one page, not forty, and no ceiling short of the result.
function loadMore() {
  page.value += 1
  countNeeded.value = false
  reload()
}

// onActivated, not onMounted: this list is KeepAlive'd, so returning to a tab never mounts again.
onActivated(() => {
  const arrived = readArrival(route.query)
  if (!arrived) return
  dropArrival(route, router)
  // A preset defines the WHOLE state, so an absent half is an empty one, not a half left standing.
  applyPreset({ filters: arrived.filters || {}, sort: arrived.sort })
})

onMounted(() => {
  // Always, like the native list; RESTART because a mount is the first page of a fresh question — unless
  // an arrival is about to ask its own question, which would make this the first of two fetches.
  if (!readArrival(route.query)) restart()
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
