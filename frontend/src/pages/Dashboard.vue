<!--
  The dashboard the CALLER'S ROLE grants. One request answers the whole page: which cards, in what order,
  at what size, with what figures, and the filter that reproduces each of them.

  Nothing here knows a chart's name, its list, its columns or its filters. That is the point — the same
  declaration produced the count and produced the drill filter, so a card and the list it opens cannot
  disagree.

  There is no layout editor. Layouts are operator config (`CRM Dashboard Layout`), so the old edit / add /
  save / reset affordance is gone rather than ported: a half-working editor writing to a doc the backend
  no longer reads is worse than no editor.

  A role with no layout is an EXPECTED state, not an error — it gets the empty state, which is why the
  sidebar link stays unconditional.
-->
<template>
  <div class="flex h-full flex-col overflow-hidden">
    <LayoutHeader>
      <template #left-header>
        <ViewBreadcrumbs routeName="Dashboard" />
      </template>
      <template #right-header>
        <Button
          :label="__('Refresh')"
          :iconLeft="LucideRefreshCcw"
          :loading="dashboard.loading"
          @click="dashboard.reload()"
        />
      </template>
    </LayoutHeader>

    <!-- Gated on `loading && !data`: a filter change must not throw away a painted dashboard. -->
    <div v-if="dashboard.loading && !dashboard.data" class="flex flex-col gap-3 p-5">
      <div class="h-9 w-full max-w-md animate-pulse rounded bg-surface-gray-3" />
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div v-for="n in 6" :key="n" class="h-24 animate-pulse rounded-md bg-surface-gray-3" />
      </div>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div v-for="n in 3" :key="n" class="h-56 animate-pulse rounded-md bg-surface-gray-3" />
      </div>
    </div>

    <!-- Keyed on `error`, not on missing data: frappe-ui restores previousData on failure, so a failed reload would otherwise leave yesterday's figures under today's filters. -->
    <EmptyState
      v-else-if="dashboard.error && !dashboard.data"
      name="Dashboard"
      :title="__('The dashboard could not be loaded')"
      :description="__('Try refreshing. If it keeps failing, tell an administrator.')"
      icon="alert-circle"
      width="lg"
    />

    <EmptyState
      v-else-if="!dashboard.data.configured"
      name="Dashboard"
      :title="__('No dashboard configured')"
      :description="
        __(
          'Your role does not have a dashboard layout yet. Ask an administrator to configure one.',
        )
      "
      width="lg"
    />

    <template v-else>
      <!-- TWO controls, the same on every viewport: the period, and everything else behind one filter
           button. The shape mirrors Filter.vue's — Popover + Button + a count badge — because that is the
           app's one filter affordance. It is NOT Filter.vue itself: that emits operator conditions
           ({field: ['like', v]}) and these are fixed single-value selects the dashboard deliberately
           cannot honour, so driving it here would make the dashboard a query builder. -->
      <div v-if="exposed.length" class="flex items-center gap-2 p-5 pb-3">
        <Dropdown v-if="shows('date_range') && !showDatePicker" :options="presetOptions">
          <Button
            :label="__(preset)"
            :iconLeft="LucideCalendar"
            iconRight="chevron-down"
            variant="outline"
          />
        </Dropdown>
        <!-- The picker replaces the preset button while a custom range is being chosen, and hands it back
             on change — "Custom Range" in the menu would otherwise be an option that opens nothing. -->
        <DateRangePicker
          v-else-if="shows('date_range')"
          ref="datePickerRef"
          class="!w-56"
          :value="filters.period"
          variant="outline"
          :placeholder="__('Period')"
          :formatter="formatRange"
          @change="
            (v) =>
              applyFilter('period', v, () => {
                showDatePicker = false
                if (v) {
                  preset = formatter(v)
                } else {
                  filters.period = getLastXDays()
                  preset = 'Last 30 Days'
                }
              })
          "
        />

        <Popover v-if="fieldFilters.length" placement="bottom-start">
          <template #target="{ togglePopover }">
            <div class="flex items-center">
              <Button
                :label="__('Filter')"
                :class="activeCount ? 'rounded-r-none' : ''"
                :iconLeft="FilterIcon"
                variant="outline"
                @click="togglePopover"
              >
                <template v-if="activeCount" #suffix>
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded-[5px] bg-surface-white pt-px text-xs font-medium text-ink-gray-8 shadow-sm"
                  >
                    {{ activeCount }}
                  </div>
                </template>
              </Button>
              <Button
                v-if="activeCount"
                class="rounded-l-none border-l"
                icon="x"
                variant="outline"
                :tooltip="__('Clear filters')"
                @click.stop="clearFilters"
              />
            </div>
          </template>
          <template #body>
            <div class="my-2 rounded-lg bg-surface-modal p-3 shadow-2xl ring-1 ring-black ring-opacity-5">
              <div class="flex w-64 flex-col gap-3">
                <div v-for="f in fieldFilters" :key="f.name" class="flex flex-col gap-1">
                  <span class="text-xs text-ink-gray-5">{{ f.label }}</span>
                  <Link
                    v-if="f.name === 'user'"
                    class="form-control"
                    variant="outline"
                    :value="filters.user && getUser(filters.user).full_name"
                    doctype="User"
                    :filters="{ name: ['in', users.data.crmUsers?.map((u) => u.name)], ignore_user_type: 1 }"
                    :placeholder="f.label"
                    :hideMe="true"
                    @change="(v) => applyFilter('user', v)"
                  />
                  <FormControl
                    v-else
                    type="select"
                    :modelValue="filters[f.name]"
                    :options="f.options"
                    :placeholder="f.label"
                    @update:modelValue="(v) => applyFilter(f.name, v)"
                  />
                </div>
              </div>
            </div>
          </template>
        </Popover>
      </div>

      <DashboardGrid
        v-if="dashboard.data.charts?.length"
        :charts="dashboard.data.charts"
        @drill="onDrill"
        @menu="openMenu"
      />
      <EmptyState
        v-else
        name="Dashboard"
        :title="__('No cards on this dashboard')"
        :description="__('Every card this layout places is currently turned off.')"
        width="lg"
      />
    </template>

    <!-- Right-click is an EXTRA, never the only way in: it does not exist on touch, so the left-click
         and the tap on the card are what actually ship the drill. -->
    <div
      v-if="menu.open"
      class="fixed inset-0 z-20"
      @click="closeMenu"
      @contextmenu.prevent="closeMenu"
    >
      <div
        class="absolute min-w-40 rounded-lg border border-outline-gray-2 bg-surface-modal p-1 shadow-2xl"
        :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      >
        <button
          class="flex w-full items-center rounded px-2 py-1.5 text-left text-base text-ink-gray-7 hover:bg-surface-gray-2"
          @click="onDrill(menu.drill)"
        >
          {{ __('Drill down') }}
        </button>
        <button
          class="flex w-full items-center rounded px-2 py-1.5 text-left text-base text-ink-gray-7 hover:bg-surface-gray-2"
          @click="openInNewTab(menu.drill)"
        >
          {{ __('Open in new tab') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import LucideRefreshCcw from '~icons/lucide/refresh-ccw'
import DashboardGrid from '@/components/Dashboard/DashboardGrid.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Link from '@/components/Controls/Link.vue'
import { usersStore } from '@/stores/users'
import { getLastXDays, formatter, formatRange } from '@/utils/dashboard'
import {
  usePageMeta,
  createResource,
  Button,
  DateRangePicker,
  Dropdown,
  Popover,
  FormControl,
} from 'frappe-ui'
import FilterIcon from '@/components/Icons/FilterIcon.vue'
import LucideCalendar from '~icons/lucide/calendar'
// TATVA: the same shared, cached scoped-grain source the lead-list filters read — one resource, no fanout.
import { useGrainFilterOptions } from '@/tatva/useGrainFilterOptions'
import { computed, reactive, ref } from 'vue'
import { toast } from 'frappe-ui'
import { useRouter } from 'vue-router'

const router = useRouter()
const { users, getUser } = usersStore()
const { valuesFor: grainValues, optionsFor: grainOptions } = useGrainFilterOptions()

const showDatePicker = ref(false)
const datePickerRef = ref(null)
const preset = ref('Last 30 Days')

// Only the period is declared here — it is this page's own control. Every other key is created when the
// server says the layout offers it, so a new filter never needs a line in this file. (Vue 3 reactive()
// is Proxy-based, so a key added later is reactive.)
const filters = reactive({ period: getLastXDays() })

const fromDate = computed(() => filters.period?.split(',')[0] || null)
const toDate = computed(() => filters.period?.split(',')[1] || null)

// ONE request for the page. NOT cached: frappe-ui returns the first instance for a key and drops the new options, so a second mount kept the first component's dead makeParams.
const dashboard = createResource({
  url: 'crm.api.dashboard.get_dashboard',
  makeParams() {
    return {
      from_date: fromDate.value,
      to_date: toDate.value,
      // What the user chose, whatever it is. Which of these the layout actually honours is the server's
      // question and it already answers it (_chosen), so this never reads the response it is building.
      filters: JSON.stringify(
        Object.fromEntries(Object.entries(filters).filter(([key]) => key !== 'period')),
      ),
    }
  },
  auto: true,
  // The resource rethrows and this app sets no fallbackErrorHandler, so without this a failure is an unhandled rejection and the stale figures say nothing.
  onError(error) {
    toast.error(error?.messages?.[0] || __('Could not load the dashboard'))
  },
})

// Which controls the caller's own layout offers. A rep's layout exposes one; a manager's exposes four.
const exposed = computed(() => dashboard.data?.filters || [])

// What the one filter control offers, as the SERVER declared it — name, wording and the column each narrows.
// `date_range` is dropped here: a period is not a field condition and keeps its own button.
const fieldFilters = computed(() =>
  exposed.value
    .filter((f) => f.name !== 'date_range')
    .filter((f) => !f.column || grainValues(f.column).length > 1)
    .map((f) => (f.column ? { ...f, options: grainOptions(f.column) } : f)),
)

const activeCount = computed(() => fieldFilters.value.filter((f) => filters[f.name]).length)

function clearFilters() {
  for (const f of fieldFilters.value) filters[f.name] = null
  dashboard.reload()
}
const shows = (name) => exposed.value.some((f) => f.name === name)

function applyFilter(key, value, callback) {
  filters[key] = value
  callback?.()
  dashboard.reload()
}

const presetOptions = computed(() => [
  {
    group: 'Presets',
    hideLabel: true,
    items: [
      { label: __('Last 7 Days'), days: 7 },
      { label: __('Last 30 Days'), days: 30 },
      { label: __('Last 60 Days'), days: 60 },
      { label: __('Last 90 Days'), days: 90 },
    ].map(({ label, days }) => ({
      label,
      onClick: () => {
        preset.value = `Last ${days} Days`
        applyFilter('period', getLastXDays(days))
      },
    })),
  },
  {
    label: __('Custom Range'),
    onClick: () => {
      showDatePicker.value = true
      setTimeout(() => datePickerRef.value?.open(), 0)
      preset.value = 'Custom Range'
      filters.period = null
    },
  },
])

const menu = reactive({ open: false, x: 0, y: 0, drill: null })

function openMenu({ drill, x, y }) {
  menu.drill = drill
  menu.x = Math.min(x, window.innerWidth - 176)
  menu.y = Math.min(y, window.innerHeight - 96)
  menu.open = true
}

function closeMenu() {
  menu.open = false
}

// Route and filters are the BACKEND's; this builds neither. `viewType` is pinned or the router fills it from the user's default view.
function drillRoute(drill) {
  return {
    name: drill.route,
    params: { viewType: 'list' },
    query: { filters: JSON.stringify(drill.filters || {}) },
  }
}

function onDrill(drill) {
  closeMenu()
  if (!drill?.route) return
  router.push(drillRoute(drill))
}

function openInNewTab(drill) {
  closeMenu()
  if (!drill?.route) return
  // noopener: the new tab must not get a handle on this one, even same-origin.
  window.open(router.resolve(drillRoute(drill)).href, '_blank', 'noopener')
}

usePageMeta(() => ({ title: dashboard.data?.title || __('Dashboard') }))
</script>
