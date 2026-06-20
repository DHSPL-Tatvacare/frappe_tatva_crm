<!--
  TATVA: SmartViewTabs — the DESKTOP Smart View strip, modelled on LeadSquared's tabs (mobile uses
  SmartViewSheet). The neatness comes from CONTENT-WIDTH tabs, NOT fixed boxes:

    • Each tab hugs its content (icon · label · count pill) up to a max width, past which the LABEL
      truncates with an ellipsis + tooltip. Short labels stay narrow; long ones cap — no dead space.
    • Count is a lazy, cached, CUMULATIVE rounded pill: only the active/visited tabs show one (read
      store.getCount direct in the template); once shown it stays and, as more appear, each widens its
      tab and nudges the rest — the bar shows as many as fit and the overflow goes to the trailing "⋮".
    • The "⋮" opens the full scrollable index (every view, active check-marked) so hidden views stay
      reachable. Active tab carries a 2px underline.

  Fit is measured (render-all → sum widths → trim), re-run on viewport resize AND when a count pill
  appears (a new pill changes widths). v-model carries the active view NAME; the parent maps it to the route.
-->
<template>
  <div ref="bar" class="flex items-stretch divide-x divide-outline-gray-1 overflow-hidden">
    <Tooltip
      v-for="tab in visibleTabs"
      :key="tab.name"
      :text="tab.label"
      :disabled="!isLong(tab)"
    >
      <button
        data-tab
        type="button"
        class="group flex max-w-[16rem] shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 duration-150 ease-in-out"
        :class="
          tab.name === modelValue
            ? 'border-ink-gray-9'
            : 'border-transparent hover:bg-surface-gray-2'
        "
        @click="select(tab.name)"
      >
        <FeatherIcon
          :name="tabIcon(tab)"
          class="h-4 w-4 shrink-0"
          :class="tab.name === modelValue ? 'text-ink-gray-8' : 'text-ink-gray-5'"
        />
        <span
          class="min-w-0 truncate text-base"
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
      </button>
    </Tooltip>

    <!-- Overflow: the full scrollable index of every view. -->
    <Popover v-if="overflowTabs.length" placement="bottom-end">
      <template #target="{ togglePopover, isOpen }">
        <button
          data-dots
          type="button"
          class="flex shrink-0 items-center justify-center border-b-2 px-2.5 duration-150 ease-in-out"
          :class="
            overflowHasActive || isOpen
              ? 'border-ink-gray-9 text-ink-gray-9'
              : 'border-transparent text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8'
          "
          :aria-label="__('More views')"
          @click="togglePopover"
        >
          <FeatherIcon name="more-vertical" class="h-4 w-4" />
        </button>
      </template>
      <template #body-main>
        <div class="max-h-80 w-64 overflow-y-auto p-1.5">
          <button
            v-for="v in views"
            :key="v.name"
            type="button"
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left duration-150 ease-in-out"
            :class="
              v.name === modelValue ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'
            "
            @click="select(v.name)"
          >
            <FeatherIcon
              :name="tabIcon(v)"
              class="h-4 w-4 shrink-0 text-ink-gray-6"
            />
            <span
              class="min-w-0 flex-1 truncate text-base"
              :class="
                v.name === modelValue
                  ? 'font-medium text-ink-gray-9'
                  : 'text-ink-gray-7'
              "
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
        </div>
      </template>
    </Popover>
  </div>
</template>

<script setup>
import { Tooltip, Popover, FeatherIcon } from 'frappe-ui'
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { useElementSize } from '@vueuse/core'
import { smartViewsStore } from '@/stores/smartViews'
import { formatCount } from '@/tatva/smartViewFormat'

const props = defineProps({
  // The ordered tab rows from get_smart_views.
  views: { type: Array, default: () => [] },
  // The active CRM Smart View name (the parent owns selection -> the route).
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const store = smartViewsStore()

const OVERFLOW_W = 40 // px reserved for the trailing "⋮"

const bar = ref(null)
const { width: barW } = useElementSize(bar)
// How many leading tabs fit; the rest overflow to "⋮". Starts "all", then measured.
const fit = ref(props.views.length)

const visibleTabs = computed(() => props.views.slice(0, fit.value))
const overflowTabs = computed(() => props.views.slice(fit.value))
const overflowHasActive = computed(() =>
  overflowTabs.value.some((t) => t.name === props.modelValue),
)

// Tooltip only when the label will actually clip (a 16rem tab fits ~26 chars after icon/count).
function isLong(tab) {
  return (tab.label || '').length > 26
}

function select(name) {
  emit('update:modelValue', name)
}

// LSQ-style line icon per tab: a person for lead views, a checkbox for activity views.
function tabIcon(tab) {
  return tab.base_object === 'Activity' ? 'check-square' : 'user'
}

// Measure how many content-width tabs fit: render them all, sum real widths, trim — reserving room
// for the "⋮" whenever something overflows. Standard responsive-tabs pattern, but content-width so
// each tab is only as wide as its own label + (cumulative) count pill.
function measure() {
  const el = bar.value
  if (!el) return
  const total = props.views.length
  if (!total) return
  if (fit.value !== total) fit.value = total // render all so we can measure true widths
  nextTick(() => {
    const el2 = bar.value
    if (!el2) return
    const avail = el2.clientWidth
    const tabs = Array.from(el2.querySelectorAll('[data-tab]'))
    let used = 0
    let n = 0
    for (let i = 0; i < tabs.length; i++) {
      const w = tabs[i].offsetWidth
      const reserve = i < total - 1 ? OVERFLOW_W : 0 // keep room for "⋮" unless this is the last tab
      if (used + w + reserve > avail) break
      used += w
      n++
    }
    fit.value = Math.max(1, n)
  })
}

onMounted(() => nextTick(measure))
// Re-measure on width change AND whenever the set or a count pill changes (a new pill shifts widths).
watch(barW, () => nextTick(measure))
watch(
  () => props.views.map((v) => `${v.name}:${store.getCount(v.name)}`).join('|'),
  () => nextTick(measure),
)
</script>
