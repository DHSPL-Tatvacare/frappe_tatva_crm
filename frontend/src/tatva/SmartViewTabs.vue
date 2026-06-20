<!--
  TATVA: SmartViewTabs — the DESKTOP Smart View strip (mobile uses SmartViewSheet instead). Designed
  from first principles so NOTHING reflows when a count loads or a tab is picked:

    • Every tab is a FIXED 176px box (w-44). Its contents — icon · label · count bubble — flex INSIDE
      that box: when the lazy count appears, the label simply truncates more; the box never grows and
      neighbours never move.
    • The strip is a WINDOW over the ordered view list. Capacity N = floor(stripWidth / tabWidth) is
      pure math off a single measured width (useElementSize), so it changes ONLY on viewport resize,
      never when data loads. As many fixed tabs as fit — no more, no less.
    • Tabs beyond the window live in the trailing "⋯" popover: a scrollable full index (every view,
      active check-marked). Picking one slides the window so the active tab is always visible — that is
      the cycling between the popover and the strip.

  Count is lazy + cached (§6): read store.getCount(name) DIRECTLY in the template so a later setCount
  re-renders the bubble. v-model carries the active view NAME; the parent maps it to the route.
-->
<template>
  <div ref="bar" class="flex items-stretch gap-1 px-3 sm:px-5">
    <button
      v-for="tab in windowTabs"
      :key="tab.name"
      type="button"
      class="group flex w-44 shrink-0 items-center gap-1.5 border-b-2 py-2.5 duration-150 ease-in-out"
      :class="
        tab.name === modelValue
          ? 'border-ink-gray-9'
          : 'border-transparent hover:border-outline-gray-3'
      "
      @click="select(tab.name)"
    >
      <Icon
        v-if="tab.icon"
        :icon="tab.icon"
        class="h-4 w-4 shrink-0"
        :class="tab.name === modelValue ? 'text-ink-gray-8' : 'text-ink-gray-5'"
      />
      <Tooltip
        :text="tab.label"
        :disabled="!isLong(tab)"
        class="min-w-0 flex-1"
      >
        <span
          class="block truncate text-left text-base"
          :class="
            tab.name === modelValue
              ? 'font-medium text-ink-gray-9'
              : 'text-ink-gray-5 group-hover:text-ink-gray-8'
          "
        >
          {{ tab.label }}
        </span>
      </Tooltip>
      <span
        v-if="store.getCount(tab.name) !== null"
        class="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums"
        :class="
          tab.name === modelValue
            ? 'bg-surface-gray-3 text-ink-gray-8'
            : 'bg-surface-gray-2 text-ink-gray-6'
        "
      >
        {{ formatCount(store.getCount(tab.name)) }}
      </span>
    </button>

    <!-- Overflow: the full scrollable index. Picking a hidden view slides the window to it. -->
    <Popover v-if="hasOverflow" placement="bottom-end">
      <template #target="{ togglePopover, isOpen }">
        <button
          type="button"
          class="flex w-9 shrink-0 items-center justify-center border-b-2 duration-150 ease-in-out"
          :class="
            overflowHasActive || isOpen
              ? 'border-ink-gray-9 text-ink-gray-9'
              : 'border-transparent text-ink-gray-5 hover:text-ink-gray-8'
          "
          :aria-label="__('More views')"
          @click="togglePopover"
        >
          <FeatherIcon name="more-horizontal" class="h-4 w-4" />
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
              v.name === modelValue
                ? 'bg-surface-gray-3'
                : 'hover:bg-surface-gray-2'
            "
            @click="select(v.name, true)"
          >
            <Icon
              v-if="v.icon"
              :icon="v.icon"
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
              class="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-surface-gray-2 px-1.5 text-xs font-medium tabular-nums text-ink-gray-6"
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
import Icon from '@/components/Icon.vue'
import { computed, ref, watch } from 'vue'
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

// Fixed geometry — a tab is always exactly TAB_W; capacity is pure math off the strip width.
const TAB_W = 176 // w-44
const GAP = 4 // gap-1
const OVERFLOW_W = 40 // the "⋯" button (w-9 + gap)

const bar = ref(null)
const { width: barW } = useElementSize(bar)
// `start` is the index of the first tab shown in the window; it slides to keep the active tab visible.
const start = ref(0)

// How many fixed tabs fit if NONE overflow vs. if the "⋯" must be reserved.
const capacityFull = computed(() =>
  Math.max(1, Math.floor((barW.value + GAP) / (TAB_W + GAP))),
)
const hasOverflow = computed(() => props.views.length > capacityFull.value)
const capacity = computed(() =>
  hasOverflow.value
    ? Math.max(1, Math.floor((barW.value - OVERFLOW_W + GAP) / (TAB_W + GAP)))
    : props.views.length,
)

const windowTabs = computed(() =>
  props.views.slice(start.value, start.value + capacity.value),
)
const activeIndex = computed(() =>
  props.views.findIndex((v) => v.name === props.modelValue),
)
const overflowHasActive = computed(
  () => hasOverflow.value && !windowTabs.value.some((t) => t.name === props.modelValue),
)

// A 176px tab fits ~18 chars after the icon; longer labels truncate, so tooltip those.
function isLong(tab) {
  return (tab.label || '').length > 18
}

function select(name) {
  emit('update:modelValue', name)
}

// Slide the window so the active tab is always visible. Minimal move: pull `start` to the active
// index when it falls left of the window, or to (active - capacity + 1) when it falls right — then
// clamp. This is the strip<->popover cycling: picking a hidden view brings it into the strip.
watch(
  [activeIndex, capacity, () => props.views.length, barW],
  () => {
    const i = activeIndex.value
    const cap = capacity.value
    const maxStart = Math.max(0, props.views.length - cap)
    if (i >= 0) {
      if (i < start.value) start.value = i
      else if (i >= start.value + cap) start.value = i - cap + 1
    }
    if (start.value > maxStart) start.value = maxStart
    if (start.value < 0) start.value = 0
  },
  { immediate: true },
)
</script>
