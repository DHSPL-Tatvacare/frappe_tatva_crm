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

    <!-- A failed request leaves `data` null, and a silent white page reads as a broken app. -->
    <EmptyState
      v-else-if="!dashboard.data"
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
      <!-- Only what the layout exposes. On a phone the row scrolls sideways rather than stacking, which is
           what ViewControls already does with its quick filters — four stacked controls would push the first
           card ~200px down the screen. -->
      <FadedScrollableDiv
        v-if="exposed.length"
        class="flex items-center gap-3 overflow-x-auto p-5 pb-2 sm:flex-wrap sm:overflow-x-visible"
        orientation="horizontal"
      >
        <Dropdown
          v-if="shows('date_range') && !showDatePicker"
          v-model="preset"
          :options="presetOptions"
          class="form-control w-48 shrink-0"
          :placeholder="__('Select Range')"
          :button="{
            label: __(preset),
            class: '!w-full justify-start [&>span]:mr-auto [&>svg]:text-ink-gray-5',
            variant: 'outline',
            iconRight: 'chevron-down',
            iconLeft: 'calendar',
          }"
        />
        <DateRangePicker
          v-else-if="shows('date_range')"
          ref="datePickerRef"
          class="!w-48 shrink-0"
          :value="filters.period"
          variant="outline"
          :placeholder="__('Period')"
          :formatter="formatRange"
          @change="
            (v) =>
              applyFilter('period', v, () => {
                showDatePicker = false
                if (!v) {
                  filters.period = getLastXDays()
                  preset = 'Last 30 Days'
                } else {
                  preset = formatter(v)
                }
              })
          "
        >
          <template #prefix>
            <LucideCalendar class="mr-2 size-4 text-ink-gray-5" />
          </template>
        </DateRangePicker>

        <Link
          v-if="shows('user')"
          class="form-control w-48 shrink-0"
          variant="outline"
          :value="filters.user && getUser(filters.user).full_name"
          doctype="User"
          :filters="{
            name: ['in', users.data.crmUsers?.map((u) => u.name)],
            ignore_user_type: 1,
          }"
          :placeholder="__('Sales User')"
          :hideMe="true"
          @change="(v) => applyFilter('user', v)"
        >
          <template #prefix>
            <UserAvatar v-if="filters.user" class="mr-2" :user="filters.user" size="sm" />
          </template>
          <template #item-prefix="{ option }">
            <UserAvatar class="mr-2" :user="option.value" size="sm" />
          </template>
          <template #item-label="{ option }">
            <Tooltip :text="option.value">
              <div class="cursor-pointer">{{ getUser(option.value).full_name }}</div>
            </Tooltip>
          </template>
        </Link>

        <!-- TATVA: the grain filters are fed by the SCOPED values on the leads this user can see, not by
             the master — a `Link` here searched CRM Vertical / CRM Program with no field context, so our
             narrow User Permission never fired and a scoped rep read every other business line's names. -->
        <FormControl
          v-if="shows('vertical') && grainValues('custom_vertical').length > 1"
          class="form-control w-44 shrink-0"
          type="select"
          :modelValue="filters.vertical"
          :options="grainOptions('custom_vertical')"
          :placeholder="__('Product Line')"
          @update:modelValue="(v) => applyFilter('vertical', v)"
        />
        <FormControl
          v-if="shows('program') && grainValues('custom_current_program').length > 1"
          class="form-control w-44 shrink-0"
          type="select"
          :modelValue="filters.program"
          :options="grainOptions('custom_current_program')"
          :placeholder="__('Program')"
          @update:modelValue="(v) => applyFilter('program', v)"
        />
      </FadedScrollableDiv>

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
import UserAvatar from '@/components/UserAvatar.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import Link from '@/components/Controls/Link.vue'
import { usersStore } from '@/stores/users'
import { getLastXDays, formatter, formatRange } from '@/utils/dashboard'
import {
  usePageMeta,
  createResource,
  DateRangePicker,
  Dropdown,
  Tooltip,
  FormControl,
} from 'frappe-ui'
// TATVA: the same shared, cached scoped-grain source the lead-list filters read — one resource, no fanout.
import { useGrainFilterOptions } from '@/tatva/useGrainFilterOptions'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const { users, getUser } = usersStore()
const { valuesFor: grainValues, optionsFor: grainOptions } = useGrainFilterOptions()

const showDatePicker = ref(false)
const datePickerRef = ref(null)
const preset = ref('Last 30 Days')

const filters = reactive({
  period: getLastXDays(),
  user: null,
  vertical: null,
  program: null,
})

const fromDate = computed(() => filters.period?.split(',')[0] || null)
const toDate = computed(() => filters.period?.split(',')[1] || null)

// ONE request for the whole page, never one per card. Deliberately NOT cached: frappe-ui returns the FIRST
// instance for a cache key and discards the new options, so a second mount kept the first component's
// makeParams — every filter went dead after navigating away and back. A dashboard is also a different
// answer per filter combination, and one key cannot name them all.
const dashboard = createResource({
  url: 'tatva_connect.dashboard.api.get_dashboard',
  makeParams() {
    return {
      from_date: fromDate.value,
      to_date: toDate.value,
      filters: JSON.stringify({
        vertical: filters.vertical || null,
        program: filters.program || null,
        user: filters.user || null,
      }),
    }
  },
  auto: true,
})

// Which controls the caller's own layout offers. A rep's layout exposes one; a manager's exposes four.
const exposed = computed(() => dashboard.data?.filters || [])
const shows = (name) => exposed.value.includes(name)

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

// The route and the filters are the BACKEND's — this builds neither and knows no field names. `viewType` is
// pinned to the list: sent without one, the router fills it from the user's default view and a drill lands
// in their kanban or a saved view that filters it again.
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
  window.open(router.resolve(drillRoute(drill)).href, '_blank')
}

usePageMeta(() => ({ title: dashboard.data?.title || __('Dashboard') }))
</script>
