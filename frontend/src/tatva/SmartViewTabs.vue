<!--
  TATVA: SmartViewTabs — the DESKTOP Smart View strip (mobile uses SmartViewSheet). Priority-plus overflow.
    • Browser-tab-bar model: each tab is `shrink-0` and sized to its own content, so tabs pack left to right and the rest of the rail stays empty.
    • Each tab is capped at `max-w-[12rem]` and its label truncates there; Tailwind 3.4 has no numeric maxWidth scale, hence the arbitrary value.
    • The label span carries `min-w-0 truncate` and NOT `flex-1` — `flex-1` implies `basis:0` and would collapse every tab to icon + count.
    • Overflow does NOT scroll: operations runs sixty views and nobody scrolls sixty tabs. Tabs that do not fit move into the "⋮" menu, which carries a search box.
    • Fitting is measured, not guessed: `useResizeObserver` (VueUse, already a fork dependency) watches the rail; widths are read once per render pass off the laid-out row and cached per view name, so hiding a tab can never change the measurement that hid it.
    • The ACTIVE tab is always on the rail. If it would fall past the cut it trades places with the last tab that fits, so selection is never invisible.
    • The right controls — the "⋮" menu (an index of EVERY view, so it carries no count: a hidden-tab badge would contradict its own contents) and "+" — are `shrink-0` and always visible, with their own left border.
    • Count is a lazy pill (only once that view's list has loaded its total, read from the store).
    • Active tab: a 2px underline pinned to the tab's bottom edge.

  v-model carries the active view NAME; the parent maps it to the route and owns "+" (create).
-->
<template>
  <div class="flex w-full items-stretch border-b border-outline-gray-2 overflow-hidden">
    <div
      ref="rail"
      class="flex min-w-0 flex-1 items-stretch divide-x divide-outline-gray-1 overflow-hidden"
    >
      <button
        v-for="(tab, i) in laidOut"
        :key="tab.name"
        type="button"
        :title="tab.label"
        :data-active="tab.name === modelValue ? 'true' : 'false'"
        class="group relative flex max-w-[12rem] shrink-0 items-center gap-2 px-3 py-2 duration-150 ease-in-out"
        :class="[
          i < visibleCount ? '' : 'invisible',
          tab.name === modelValue ? '' : 'hover:bg-surface-gray-2',
        ]"
        @click="select(tab.name)"
      >
        <FeatherIcon
          :name="tabIcon(tab)"
          class="h-4 w-4 shrink-0"
          :class="tab.name === modelValue ? 'text-ink-gray-8' : 'text-ink-gray-5'"
        />
        <span
          class="min-w-0 truncate text-left text-sm"
          :class="
            tab.name === modelValue
              ? 'font-medium text-ink-gray-9'
              : 'text-ink-gray-6 group-hover:text-ink-gray-8'
          "
        >
          {{ tab.label }}
        </span>
        <span
          v-if="store.getCount(tab.name) !== null"
          class="shrink-0 rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs font-medium tabular-nums"
          :class="tab.name === modelValue ? 'text-ink-gray-7' : 'text-ink-gray-5'"
        >
          {{ formatCount(store.getCount(tab.name)) }}
        </span>
        <!-- active indicator: theme-aware (dark in light, light in dark), one per active tab -->
        <span
          v-if="tab.name === modelValue"
          class="absolute inset-x-0 bottom-0 h-0.5 bg-surface-gray-7"
        />
      </button>
    </div>

    <!-- right controls: never compressed (shrink-0), own left border since divide-x moved to the scroller. -->
    <div
      class="flex shrink-0 items-stretch divide-x divide-outline-gray-1 border-l border-outline-gray-1"
    >
      <Popover placement="bottom-end">
        <template #target="{ togglePopover, isOpen }">
          <button
            type="button"
            class="flex items-center justify-center px-2.5 py-2 duration-150 ease-in-out"
            :class="
              isOpen
                ? 'text-ink-gray-9'
                : 'text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8'
            "
            :aria-label="__('All views')"
            @click="togglePopover"
          >
            <FeatherIcon name="more-vertical" class="h-4 w-4" />
          </button>
        </template>
        <template #body-main="{ close }">
          <div class="w-72 p-1.5">
            <FormControl
              ref="search"
              v-model="query"
              type="text"
              :placeholder="__('Search views…')"
              class="mb-1.5"
            >
              <template #prefix>
                <FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" />
              </template>
            </FormControl>
            <div v-if="!matches.length" class="px-2 py-3 text-center text-sm text-ink-gray-5">
              {{ __('No views match') }}
            </div>
            <div class="max-h-80 overflow-y-auto">
            <div
              v-for="v in matches"
              :key="v.name"
              class="group/row flex items-center gap-1 rounded duration-150 ease-in-out"
              :class="v.name === modelValue ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                @click="select(v.name)"
              >
                <FeatherIcon :name="tabIcon(v)" class="h-4 w-4 shrink-0 text-ink-gray-6" />
                <span
                  class="min-w-0 flex-1 truncate text-sm"
                  :class="v.name === modelValue ? 'font-medium text-ink-gray-9' : 'text-ink-gray-7'"
                >
                  {{ v.label }}
                </span>
                <span
                  v-if="store.getCount(v.name) !== null"
                  class="shrink-0 rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink-gray-5"
                >
                  {{ formatCount(store.getCount(v.name)) }}
                </span>
                <FeatherIcon
                  v-if="v.name === modelValue"
                  name="check"
                  class="h-3.5 w-3.5 shrink-0 text-ink-gray-9"
                />
              </button>
              <!-- edit affordance: only when the caller can write this view (server re-checks) -->
              <button
                v-if="v.can_write"
                type="button"
                class="mr-1 hidden shrink-0 rounded p-1 text-ink-gray-5 duration-150 ease-in-out hover:bg-surface-gray-4 hover:text-ink-gray-8 group-hover/row:block"
                :aria-label="__('Edit view')"
                @click="onEdit(v.name, close)"
              >
                <FeatherIcon name="edit-2" class="h-3.5 w-3.5" />
              </button>
            </div>
            </div>
          </div>
        </template>
      </Popover>

      <button
        type="button"
        class="flex items-center justify-center px-2.5 py-2 text-ink-gray-5 duration-150 ease-in-out hover:bg-surface-gray-2 hover:text-ink-gray-8"
        :aria-label="__('Add view')"
        @click="emit('create')"
      >
        <FeatherIcon name="plus" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { useResizeObserver } from '@vueuse/core'
import { Popover, FeatherIcon, FormControl } from 'frappe-ui'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { smartViewsStore } from '@/stores/smartViews'
import { formatCount } from '@/tatva/smartViewFormat'

const props = defineProps({
  // The ordered tab rows from get_smart_views.
  views: { type: Array, default: () => [] },
  // The active CRM Smart View name (the parent owns selection -> the route).
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'create', 'edit'])

const store = smartViewsStore()

// --- overflow: how many tabs actually fit ----------------------------------
// Tabs past the cut are `invisible`, NOT `display:none`. An invisible element keeps its box, so every
// tab reports its true width whether shown or not and hiding one can never change the measurement that
// hid it — the feedback loop that makes this flicker simply has no way to form. Nothing is cached: the
// live DOM is always truthful.
const rail = ref(null)
const visibleCount = ref(props.views.length)

function measure() {
  const el = rail.value
  if (!el) return
  const available = el.clientWidth
  const kids = [...el.children]
  // The active tab's width is RESERVED before anything else is counted, because `laidOut` will pull it
  // onto the rail whatever this says. Measuring without it let the swap trade a narrow tab for a wide one
  // and overflow a rail that does not scroll — the selected tab, clipped.
  const activeIdx = kids.findIndex((k) => k.dataset.active === 'true')
  let used = activeIdx >= 0 ? kids[activeIdx].offsetWidth : 0
  let fits = activeIdx >= 0 ? 1 : 0
  for (let i = 0; i < kids.length; i++) {
    if (i === activeIdx) continue
    used += kids[i].offsetWidth
    if (used > available) break
    fits += 1
  }
  // Never zero: a rail too narrow for one tab still shows the one you are looking at.
  visibleCount.value = Math.max(1, Math.min(fits, props.views.length))
}

// Measured in onMounted — after Vue patches the DOM and before the browser paints that frame — so the
// overfull first render is never seen. `visibleCount` starts at the full length so nothing is missing
// if the measure is somehow skipped.
onMounted(measure)
useResizeObserver(rail, measure)
// A count pill arriving WIDENS its tab, so a fit computed before it is stale. The views list changing
// does the same. Both re-measure after the DOM has caught up.
watch(
  () => [
    props.views.map((v) => v.name).join('|'),
    props.views.map((v) => store.getCount(v.name)).join('|'),
    props.modelValue,
  ],
  () => nextTick(measure),
)

// The active tab is always ON the rail: if it would fall past the cut it trades places with the last
// tab that fits, so the thing you have selected is never the thing you cannot see. Order is otherwise
// exactly as the server ordered it.
const laidOut = computed(() => {
  const list = [...props.views]
  const active = list.findIndex((v) => v.name === props.modelValue)
  const last = visibleCount.value - 1
  if (active > last && last >= 0) {
    ;[list[last], list[active]] = [list[active], list[last]]
  }
  return list
})

// --- the ⋮ index: every view, searchable ------------------------------------
const query = ref('')
const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? props.views.filter((v) => (v.label || '').toLowerCase().includes(q)) : props.views
})

function select(name) {
  emit('update:modelValue', name)
}

function onEdit(name, close) {
  close?.()
  emit('edit', name)
}

// LSQ-style line icon per tab: a person for lead views, a checkbox for activity views.
function tabIcon(tab) {
  return tab.base_object === 'Activity' ? 'check-square' : 'user'
}
</script>
