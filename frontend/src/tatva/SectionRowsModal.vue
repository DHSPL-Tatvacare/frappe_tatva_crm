<!--
  TATVA: SectionRowsModal — a lead section IS a child table, so this is that table.

  The Data tab flattens a multi-row section to its latest row (a lab report, a drug cycle); `View more`
  on the section header opens every row of it here. Built as a standard listing surface and nothing
  else: the ViewControls toolbar (search · Filter · SortBy · ColumnSettings), the native bounded
  ListView, and ListFooter for paging. Every control is the app's own component fed a server-supplied
  field list — none of them is re-implemented, and none of them learns anything about this modal.

  Columns come from the child doctype's meta and ALL of them are shown; narrowing is the picker's job.
  Paging is the Leads contract verbatim (C1–C7) and its state lives on the resource's params, nowhere else.
-->
<template>
  <ResponsiveDialog v-model="show" mode="snap" :options="{ size: '6xl' }">
    <template #body-title>
      <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
        {{ __(rowsResource.data?.label || label) }}
      </h3>
    </template>

    <template #body-content>
      <div class="flex flex-col gap-3">
        <!-- The native list toolbar (ViewControls.vue): search left, the controls grouped right.
             `hideLabel` on mobile is the prop each already carries, so the bar never wraps (H5). -->
        <div class="flex items-center gap-2">
          <FormControl
            v-model="search"
            type="text"
            :placeholder="__('Search')"
            class="w-40 sm:w-60"
            @input="onSearch"
          >
            <template #prefix>
              <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
            </template>
          </FormControl>
          <div class="ml-auto flex items-center gap-2">
            <Filter
              v-model="view"
              :doctype="doctype"
              :fields="filterFields"
              :hideLabel="isMobileView"
              @update="onFilterUpdate"
            />
            <SortBy
              v-model="view"
              :doctype="doctype"
              :fields="sortFields"
              :hideLabel="isMobileView"
              @update="onSortUpdate"
            />
            <ColumnSettings
              v-model="view"
              :doctype="doctype"
              :fieldSource="fieldSource"
              :hideLabel="isMobileView"
              @update="onColumnsUpdate"
            />
          </div>
        </div>

        <div
          v-if="rowsResource.loading && !rows.length"
          class="flex h-[50vh] flex-col items-center justify-center gap-3 text-base text-ink-gray-6"
        >
          <LoadingIndicator class="h-5 w-5" />
          <span>{{ __('Loading...') }}</span>
        </div>
        <ErrorMessage
          v-else-if="rowsResource.error"
          :message="
            rowsResource.error.messages?.[0] || String(rowsResource.error)
          "
        />
        <EmptyState
          v-else-if="!rows.length"
          name="section-rows"
          :title="narrowed ? __('No matches') : __('Nothing recorded')"
          :description="
            narrowed
              ? __(
                  'Nothing matches your search or filters. Clear them to see every record.',
                )
              : __('This section keeps no records for this lead yet.')
          "
          icon="file-text"
        />

        <!-- The table sits on its own surface: ListRow draws its separator in `border-outline-gray-1`,
             which has no contrast against `bg-surface-modal` — the lines were being drawn and not read. -->
        <div
          v-else
          class="flex max-h-[50vh] flex-col overflow-hidden rounded border border-outline-gray-2 bg-surface-white p-2"
        >
          <ListView
            :columns="columns"
            :rows="displayRows"
            row-key="name"
            :options="{
              selectable: false,
              showTooltip: true,
              resizeColumn: true,
            }"
          >
            <ListHeader>
              <ListHeaderItem
                v-for="column in columns"
                :key="column.key"
                :item="column"
              />
            </ListHeader>
            <ListRows
              v-slot="{ column, item }"
              :rows="displayRows"
              :doctype="doctype"
            >
              <ListRowItem
                :item="item"
                :align="column.align"
                class="overflow-hidden"
              >
                <template #default="{ label: cell }">
                  <span
                    v-if="isPill(column) && cell"
                    class="inline-flex max-w-full items-center truncate rounded bg-surface-gray-2 px-2 py-0.5 text-sm text-ink-gray-7"
                  >
                    {{ cell }}
                  </span>
                  <div
                    v-else
                    class="truncate text-base"
                    :class="{ 'text-ink-gray-4': !cell }"
                  >
                    {{ cell || '—' }}
                  </div>
                </template>
              </ListRowItem>
            </ListRows>
          </ListView>
        </div>

        <!-- At the server's ceiling the window can grow no further, so the Load More half retires and
             says why (SmartViewList's shape) rather than being offered and doing nothing. -->
        <ListFooter
          v-if="rows.length"
          v-model="pageLengthCount"
          class="border-t border-outline-gray-1 pt-2"
          :options="{ rowCount, totalCount }"
          @loadMore="loadMore"
        >
          <template v-if="atServerCap" #right>
            <div class="text-base text-ink-gray-5">
              {{
                __(
                  '{0} of {1} — narrow with a search or filter to see the rest.',
                  [rowCount, totalCount],
                )
              }}
            </div>
          </template>
        </ListFooter>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import ColumnSettings from '@/components/ColumnSettings.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import Filter from '@/components/Filter.vue'
import ListRows from '@/components/ListViews/ListRows.vue'
import SortBy from '@/components/SortBy.vue'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { widthFor, formatCell, isPill, alignFor } from '@/tatva/listColumns'
import { isMobileView } from '@/composables/settings'
import {
  ListView,
  ListHeader,
  ListHeaderItem,
  ListRowItem,
  ListFooter,
  ErrorMessage,
  FeatherIcon,
  FormControl,
  LoadingIndicator,
  createResource,
} from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps({
  lead: { type: String, required: true },
  section: { type: String, required: true },
  // The child doctype the section stores its rows in — what Filter/SortBy/ColumnSettings are about.
  doctype: { type: String, required: true },
  label: { type: String, default: '' },
})

const show = defineModel({ type: Boolean })

const search = ref('')
const PAGE_MAX = 200

// The ONE list-shaped model the three native controls read and write, exactly as ViewControls holds it.
// A ref, not reactive: each control binds it with `defineModel`, which reassigns the binding itself.
// This is the toolbar's home — Filter reads its chips off `params.filters` (`Filter.vue:236`) and
// SortBy writes `params.order_by` itself.
const view = ref({
  data: { columns: [], rows: [], is_default: true },
  params: { filters: {}, order_by: '' },
})

const PAGE_DEFAULT = 20

const rowsResource = createResource({
  url: 'tatva_connect.lead.detail.lead_detail_rows',
})

// Paging state lives on the resource's params and NOWHERE else (C5): `page_length` is the window Load
// More widens, `page_length_count` the page SIZE the footer picks. `out.params` is null until the first
// fetch and is only ever ASSIGNED, never mutated (`resources.js:44,64`) — so this reads through a
// default rather than assuming the object is already there. `out` is reactive, so the footer tracks it.
function paging() {
  const p = rowsResource.params || {}
  return {
    page_length: p.page_length ?? PAGE_DEFAULT,
    page_length_count: p.page_length_count ?? PAGE_DEFAULT,
  }
}

// One assignment builds the whole request: the toolbar's own state (filters/order_by live on
// `view.params`, where Filter reads its chips from), the search box, and the paging above.
function reload(overrides = {}) {
  const { filters, order_by } = view.value.params
  rowsResource.params = {
    lead: props.lead,
    section: props.section,
    search: search.value || undefined,
    filters: Object.keys(filters || {}).length
      ? JSON.stringify(filters)
      : undefined,
    order_by: order_by || undefined,
    ...paging(),
    ...overrides,
  }
  // frappe-ui rethrows even with onError (resources.js:172) — uncaught this is an unhandled rejection.
  return rowsResource.reload().catch(() => {})
}

// A new search, filter, sort or size RESTARTS at the first window (C6) — a new question, not "more".
function restart() {
  reload({ page_length: paging().page_length_count })
}

// The Leads shape (`ViewControls.vue:1058`): refetch 0..N with a bigger window, never a cursor.
function loadMore() {
  const { page_length, page_length_count } = paging()
  reload({ page_length: Math.min(page_length + page_length_count, PAGE_MAX) })
}

// The footer's v-model is the page SIZE; writing it restarts at one page of that size (C4/C6).
const pageLengthCount = computed({
  get: () => paging().page_length_count,
  set: (value) => reload({ page_length_count: value, page_length: value }),
})

const onSearch = useDebounceFn(() => restart(), 300)

// Filter emits frappe's OWN filter dict ({field: value} / {field: [op, value]}), which is what the
// server hands straight to get_all — there is no translation layer, and none is wanted. Written back
// onto view.params because that is where Filter's own chip row reads from (Filter.vue:236).
function onFilterUpdate(dict) {
  view.value.params.filters = dict || {}
  restart()
}

// SortBy writes view.params.order_by itself and emits the string; the server allowlists it.
function onSortUpdate() {
  restart()
}

const rows = computed(() => rowsResource.data?.data || [])
const rowCount = computed(() => rowsResource.data?.row_count || 0)
const totalCount = computed(() => rowsResource.data?.total_count || 0)
const rowKey = computed(() => rowsResource.data?.row_key || '')
const served = computed(() => rowsResource.data?.columns || [])
const narrowed = computed(
  () =>
    Boolean(search.value) ||
    Object.keys(view.value.params.filters || {}).length > 0,
)
const atServerCap = computed(
  () => paging().page_length >= PAGE_MAX && totalCount.value > rowCount.value,
)

// Every column of the child table, in the shape the picker and the grid both use.
const fieldSource = computed(() =>
  served.value.map((c) => ({
    fieldname: c.key,
    label: c.label,
    fieldtype: c.fieldtype,
    options: c.options,
  })),
)
const filterFields = computed(() => fieldSource.value)
// D5: only columns the server says hold a value in this lead's rows. Sorting by a column that is null
// on every row orders by the tiebreaker while looking authoritative.
const sortFields = computed(() =>
  served.value
    .filter((c) => c.sortable)
    .map((c) => ({ fieldname: c.key, label: c.label })),
)

function toColumn(c) {
  return {
    key: c.key,
    label: c.label,
    type: c.fieldtype,
    options: c.options,
    width: widthFor(c.fieldtype, c.key === rowKey.value),
    align: alignFor(c.fieldtype),
  }
}

// The default is the whole table — every column of the child doctype, like a listing page opens on its
// view's columns. Narrowing is the column picker's job, never a set decided for the reader here.
function applyDefaultColumns() {
  view.value.data.columns = served.value.map(toColumn)
  view.value.data.rows = view.value.data.columns.map((c) => c.key)
  view.value.data.is_default = true
}

// Rebuilt only when the SERVED set changes, never on a data reload — the grid mutates `column.width`
// live during a resize drag, and a search must not snap a dragged width back to the fieldtype default.
watch(
  () => served.value.map((c) => c.key).join('|'),
  (keys) => keys && applyDefaultColumns(),
  { immediate: true },
)

// ColumnSettings mutates view.value.data.columns in place for add/remove/edit; it emits `isDefault` when the
// reader asks for the default set back, and `reset` with the columns it snapshotted on open.
function onColumnsUpdate(obj) {
  if (obj?.isDefault) return applyDefaultColumns()
  if (obj?.reset) {
    view.value.data.columns = obj.columns
    view.value.data.rows = obj.rows
  }
}

const columns = computed(() => view.value.data.columns)

// ListRowItem renders row[column.key], so cells are pre-formatted to display strings here.
const displayRows = computed(() =>
  rows.value.map((r) => {
    const out = { name: r.name }
    for (const c of columns.value) out[c.key] = formatCell(r[c.key], c.type)
    return out
  }),
)

onMounted(() => reload())
</script>
