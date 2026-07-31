<!--
  One tile. The card decides what it is from `chart.type`, and nothing here knows a chart's name, its
  list, its columns or its filters — all of that was resolved server-side and arrives in the payload.

  A card that came back with an `error` renders its own "couldn't load" state: one broken declaration
  costs one tile and never the grid.

  `cursor-pointer` is drawn only where a click really navigates. A number card carries the whole-card
  drill, so it is the clickable one; on a grouped card only the SLICE drills, and putting the pointer
  cursor on its empty space would be the DOM telling the user something untrue.
-->
<template>
  <div
    class="flex h-full w-full flex-col overflow-hidden rounded-md bg-surface-white shadow"
    @contextmenu="onContextMenu"
  >
    <div
      v-if="chart.error"
      class="flex h-full w-full flex-col items-center justify-center gap-1 px-4 text-center"
    >
      <FeatherIcon name="alert-circle" class="size-4 text-ink-gray-5" />
      <span class="truncate text-sm font-medium text-ink-gray-6">
        {{ chart.label }}
      </span>
      <span class="text-p-sm text-ink-gray-5">
        {{ __("This card couldn't load") }}
      </span>
    </div>

    <NumberChart
      v-else-if="chart.type === 'number'"
      class="!items-start"
      :class="{ 'cursor-pointer': chart.drill?.route }"
      :config="numberConfig"
      @click="onCardClick"
    >
      <template #delta>
        <span class="truncate text-xs text-ink-gray-5">{{ chart.subtitle }}</span>
      </template>
    </NumberChart>

    <template v-else>
      <div class="flex shrink-0 flex-col px-4 pt-3">
        <span class="truncate text-sm font-medium text-ink-gray-5">
          {{ chart.label }}
        </span>
        <span v-if="chart.subtitle" class="truncate text-xs text-ink-gray-5">
          {{ chart.subtitle }}
        </span>
      </div>
      <div class="min-h-0 flex-1">
        <TatvaChart :chart="chart" @drill="(drill) => emit('drill', drill)" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { FeatherIcon, NumberChart } from 'frappe-ui'
import TatvaChart from '@/tatva/TatvaChart.vue'
import { computed } from 'vue'

const props = defineProps({
  chart: { type: Object, required: true },
})

const emit = defineEmits(['drill', 'menu'])

const numberConfig = computed(() => ({
  title: props.chart.label,
  value: props.chart.value,
}))

function onCardClick() {
  if (props.chart.drill?.route) emit('drill', props.chart.drill)
}

// Right-click offers the same destination plus a new tab. It is an extra, never the only way in — a
// right-click does not exist on touch, so the left-click and the tap above are what actually ship it.
function onContextMenu(event) {
  if (!props.chart.drill?.route) return
  event.preventDefault()
  emit('menu', { drill: props.chart.drill, x: event.clientX, y: event.clientY })
}
</script>
