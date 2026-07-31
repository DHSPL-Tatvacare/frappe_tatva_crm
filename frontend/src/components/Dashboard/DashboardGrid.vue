<!--
  The grid places what the SERVER placed. `x/y/w/h` come off the layout row a role's dashboard declares,
  so this component reads the arrangement and never writes it back — there is no editing in this surface
  and `disabled` turns drag and resize off together (it is the wrapper's only lever for either).

  Mobile needs no code here: frappe-ui's wrapper hardcodes `responsive: true` with `xs`/`xxs` at one
  column, so below 768px the grid is already a single column ordered by the authored (y, x).
-->
<template>
  <div class="flex-1 overflow-y-auto p-3">
    <GridLayout
      class="h-fit w-full"
      :cols="12"
      :rowHeight="60"
      disabled
      :modelValue="layout"
    >
      <template #item="{ i }">
        <div class="flex h-full w-full p-2">
          <DashboardItem
            :chart="byName[i]"
            @drill="(drill) => emit('drill', drill)"
            @menu="(menu) => emit('menu', menu)"
          />
        </div>
      </template>
    </GridLayout>
  </div>
</template>

<script setup>
import { GridLayout } from 'frappe-ui'
import DashboardItem from '@/components/Dashboard/DashboardItem.vue'
import { computed } from 'vue'

const props = defineProps({
  charts: { type: Array, default: () => [] },
})

const emit = defineEmits(['drill', 'menu'])

// Fresh objects, never the payload's own — grid-layout-plus compacts by mutating the items it is handed.
// `??` and not `||`: the server decided the placement, and x=0 is a real column, not a missing one.
const layout = computed(() =>
  props.charts.map((chart) => ({
    i: chart.chart,
    x: chart.x ?? 0,
    y: chart.y ?? 0,
    w: chart.w ?? 2,
    h: chart.h ?? 2,
  })),
)

// The tile is found by the card's NAME, not by its position: under `responsive: true` grid-layout-plus
// swaps in its own per-breakpoint array, so an index would put the wrong card in the wrong tile on a phone.
const byName = computed(() =>
  Object.fromEntries(props.charts.map((chart) => [chart.chart, chart])),
)
</script>
