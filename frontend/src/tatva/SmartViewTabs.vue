<!--
  TATVA: SmartViewTabs — a custom single-line Smart View tab strip (NOT the frappe-ui Tabs primitive,
  which wraps). A horizontal, non-wrapping row of tabs: each tab = its (truncated) label + a small
  circular COUNT bubble. The count is LAZY (§6): a tab shows NO bubble until its list has loaded and
  pushed its `total` into the store; the bubble reads `store.getCount(tab.name)` DIRECTLY in the
  template (never precomputed into a tabs array) so a later setCount re-renders it. Tabs that don't fit
  the viewport spill into a trailing "+N" Dropdown (overflow is computed from measured widths via a
  ResizeObserver). The active tab is marked with an accent underline. v-model carries the active view
  NAME; the parent maps it to the route. The list body lives in the parent (one list, re-keyed per view).
-->
<template>
  <div ref="bar" class="flex min-w-0 items-stretch gap-1 px-3 sm:px-5">
    <!-- Visible tabs (only those that fit; the rest go to the overflow menu) -->
    <Tooltip
      v-for="tab in visibleTabs"
      :key="tab.name"
      :text="tab.label"
      :disabled="!isTruncated(tab)"
    >
      <button
        type="button"
        class="group relative flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-base duration-200 ease-in-out"
        :class="
          tab.name === modelValue
            ? 'border-ink-gray-9 text-ink-gray-9'
            : 'border-transparent text-ink-gray-5 hover:text-ink-gray-8'
        "
        @click="emit('update:modelValue', tab.name)"
      >
        <Icon v-if="tab.icon" :icon="tab.icon" class="h-4 w-4 shrink-0" />
        <span class="max-w-[160px] truncate">{{ tab.label }}</span>
        <span
          v-if="store.getCount(tab.name) !== null"
          class="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums"
          :class="
            tab.name === modelValue
              ? 'bg-surface-gray-3 text-ink-gray-8'
              : 'bg-surface-gray-2 text-ink-gray-6'
          "
        >
          {{ store.getCount(tab.name) }}
        </span>
      </button>
    </Tooltip>

    <!-- Spillover: tabs that don't fit live here -->
    <Dropdown v-if="overflowTabs.length" :options="overflowOptions" placement="right">
      <button
        type="button"
        class="flex shrink-0 items-center gap-1 self-center rounded px-2 py-1 text-sm text-ink-gray-6 duration-200 ease-in-out hover:bg-surface-gray-2 hover:text-ink-gray-8"
        :class="overflowHasActive ? 'text-ink-gray-9' : ''"
      >
        <span class="font-medium">+{{ overflowTabs.length }}</span>
        <FeatherIcon name="chevron-down" class="h-3.5 w-3.5" />
      </button>
    </Dropdown>
  </div>
</template>

<script setup>
import { Tooltip, Dropdown, FeatherIcon } from 'frappe-ui'
import Icon from '@/components/Icon.vue'
import { computed, ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { smartViewsStore } from '@/stores/smartViews'

const props = defineProps({
  // The ordered tab rows from get_smart_views.
  views: { type: Array, default: () => [] },
  // The active CRM Smart View name (the parent owns selection -> the route).
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const store = smartViewsStore()

const bar = ref(null)
// How many leading tabs fit on one line; the rest overflow. Starts "all visible", then measured.
const fitCount = ref(props.views.length)

const visibleTabs = computed(() => props.views.slice(0, fitCount.value))
const overflowTabs = computed(() => props.views.slice(fitCount.value))
const overflowHasActive = computed(() =>
  overflowTabs.value.some((t) => t.name === props.modelValue),
)

// A label is truncated past max-w-[160px]; we tooltip those. Heuristic on char count keeps it cheap
// (the strip never re-measures per-label) — long labels get the tooltip, short ones don't.
function isTruncated(tab) {
  return (tab.label || '').length > 22
}

// Clicking an overflow tab activates it. Per §3 it can swap into view: re-measuring after activation
// naturally pulls the now-active tab forward when widths allow.
const overflowOptions = computed(() =>
  overflowTabs.value.map((tab) => ({
    label: tab.label,
    onClick: () => emit('update:modelValue', tab.name),
  })),
)

// Measure which tabs fit. We render every tab to an off-DOM ruler, sum widths until we exceed the
// bar's width (reserving room for the "+N" button), and set fitCount. Standard responsive-tabs pattern.
const RESERVE = 64 // px kept for the "+N" overflow button
const GAP = 4 // px, matches gap-1

function measure() {
  const el = bar.value
  if (!el) return
  const avail = el.clientWidth
  // Children are the Tooltip-wrapped buttons (one per visible tab) + the optional overflow Dropdown.
  // Re-render all tabs first so we measure against the full set, then trim.
  const total = props.views.length
  if (!total) return

  // Temporarily show all to measure true widths.
  if (fitCount.value !== total) {
    fitCount.value = total
  }
  nextTick(() => {
    const el2 = bar.value
    if (!el2) return
    // With fitCount === total the overflow Dropdown is hidden, so every child is a tab button.
    const buttons = Array.from(el2.children)
    let used = 0
    let fit = 0
    for (let i = 0; i < buttons.length && i < total; i++) {
      const w = buttons[i].offsetWidth + (i > 0 ? GAP : 0)
      // If not the last tab, leave room for the overflow button.
      const reserve = i < total - 1 ? RESERVE : 0
      if (used + w + reserve > avail) break
      used += w
      fit++
    }
    fitCount.value = Math.max(1, fit)
  })
}

let ro = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(() => measure())
  if (bar.value) ro.observe(bar.value)
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
})

// Re-measure when the view set changes (count of tabs / labels differ).
watch(() => props.views.map((v) => v.name).join('|'), () => nextTick(measure))
</script>
