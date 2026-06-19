<!--
  TATVA: SmartViewList — the read-only list body of a Smart View. Modelled on
  components/ListViews/TasksListView.vue: it feeds :columns/:rows from a frappe-ui createResource
  (tatva_connect.smartview.api.get_data) straight into the frappe-ui ListView (the same column/row
  contract the native lists use — row[column.key] is the cell value). Native sort (header click) and
  selection come free; a search box + page size re-query get_data server-side. On every successful
  load the view's `total` is pushed to the smartViews store as its lazy count (§6). Row click routes
  to the existing native detail page (Lead view -> the Lead page). Read-only — no writes here.
-->
<template>
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- search -->
    <div class="flex shrink-0 items-center gap-2 px-3 py-2 sm:px-5">
      <FormControl
        v-model="search"
        type="text"
        :placeholder="__('Search')"
        class="w-64"
        @input="onSearch"
      >
        <template #prefix>
          <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
        </template>
      </FormControl>
      <div class="ml-auto text-sm text-ink-gray-5">
        <span class="font-medium text-ink-gray-7">{{ total }}</span>
        {{ __('records') }}
      </div>
    </div>

    <div v-if="loading && !rows.length" class="flex flex-1 items-center justify-center text-sm text-ink-gray-5">
      {{ __('Loading…') }}
    </div>
    <div v-else-if="errored" class="flex flex-1 items-center justify-center text-sm text-ink-gray-5">
      {{ __('You do not have access to this view.') }}
    </div>

    <ListView
      v-else
      :columns="columns"
      :rows="rows"
      row-key="name"
      :options="{
        onRowClick: openRow,
        selectable: true,
        showTooltip: true,
        resizeColumn: true,
        emptyState: {
          title: __('No records'),
          description: __('No rows match this view.'),
        },
      }"
      class="flex-1"
    />

    <ListFooter
      v-if="!errored"
      v-model="pageLength"
      class="border-t border-outline-gray-1 px-3 py-2 sm:px-5"
      :options="{ rowCount: rows.length, totalCount: total }"
      @loadMore="loadMore"
    />
  </div>
</template>

<script setup>
import { ListView, ListFooter, FormControl, FeatherIcon, createResource } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { smartViewsStore } from '@/stores/smartViews'

const props = defineProps({
  // The CRM Smart View `name` (the doctype row name), driving get_data.
  viewName: { type: String, required: true },
  baseObject: { type: String, default: 'Lead' },
})

const router = useRouter()
const store = smartViewsStore()

const search = ref('')
const sort = ref(null) // [field_key, 'asc'|'desc']
const page = ref(1)
const pageLength = ref(50)

const columns = ref([])
const rows = ref([])
const total = ref(0)
const errored = ref(false)

const COL_WIDTH = '12rem'

// The server params for get_data. A plain function (mirrors ViewControls' getParams) — createResource
// has no `makeParams` method, so we set `list.params` from this on each (re)load.
function getParams() {
  return {
    view: props.viewName,
    search: search.value || undefined,
    sort: sort.value ? JSON.stringify(sort.value) : undefined,
    page: page.value,
    page_size: pageLength.value,
  }
}

const list = createResource({
  url: 'tatva_connect.smartview.api.get_data',
  cache: ['smart-view', props.viewName],
  params: getParams(),
  onSuccess(data) {
    errored.value = false
    columns.value = (data.columns || []).map((c) => ({
      key: c.key,
      label: c.label,
      width: COL_WIDTH,
    }))
    rows.value = data.rows || []
    total.value = data.total || 0
    // §6: report this view's count so the tab badge updates (lazy, on load/re-load).
    store.setCount(props.viewName, total.value)
  },
  onError() {
    errored.value = true
    columns.value = []
    rows.value = []
    total.value = 0
  },
})

const loading = computed(() => list.loading)

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

// Re-query when the active view changes (the page keeps this component mounted across tabs).
watch(
  () => props.viewName,
  () => {
    search.value = ''
    sort.value = null
    page.value = 1
    pageLength.value = 50
    reload()
  },
  { immediate: true },
)

function openRow(row) {
  if (!row?.name) return
  // Read-only navigation to the existing native detail. Lead view rows ARE leads; activity rows are
  // tasks — route to the lead when the view projected a lead reference, else fall back to the lead id.
  if (props.baseObject === 'Lead') {
    router.push({ name: 'Lead', params: { leadId: row.name } })
    return
  }
  const leadId = row['act:reference_docname'] || row['lead:name'] || row.reference_docname
  if (leadId) router.push({ name: 'Lead', params: { leadId } })
}
</script>
