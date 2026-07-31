<!--
  TatvaChart — the ONE grouped-chart renderer on the dashboard. Donut and bar, from the same payload.

  WHY IT EXISTS, and it is forced rather than preferred. frappe-ui's `DonutChart` and `AxisChart` render
  `<ECharts :options :error />` and never forward the `events` prop that `ECharts.vue:29-31` supports, so
  a slice in either of them cannot be clicked. Their options builders would let us pass it ourselves, but
  frappe-ui's `package.json` exports map has no wildcard subpath — `frappe-ui/src/components/Charts/...`
  does not resolve. `ECharts` itself IS a root export, so the options are built here.

  It is also LESS code than adapting, because the backend already hands both chart types the same uniform
  `points[]` of `{label, raw, value, drill}`. One shape in, two renderings out.

  THE INDEX IS THE CONTRACT. `params.dataIndex` indexes the array we handed echarts, so the series data is
  built from `chart.points` in payload order and NEVER re-sorted afterwards. The backend already ordered
  it by value; re-sorting here would make every drill click open somebody else's slice.

  Known upstream quirk: `ECharts.vue` never calls `chart.dispose()` on unmount, only unobserving its
  ResizeObserver — harmless for a fixed set of cards mounted once, so do not mount charts in a loop.
-->
<template>
  <ECharts
    v-if="hasPoints"
    :options="options"
    :events="events"
    class="h-full w-full px-2 pb-2"
  />
  <div
    v-else
    class="flex h-full w-full items-center justify-center px-4 text-center text-p-sm text-ink-gray-5"
  >
    {{ __('Nothing to show for this range') }}
  </div>
</template>

<script setup>
import { ECharts } from 'frappe-ui'
import { computed } from 'vue'
import { theme } from '@/stores/theme'
import { cssToken } from '@/utils'
import { formatCount } from '@/tatva/smartViewFormat'

const props = defineProps({
  chart: { type: Object, required: true },
})

const emit = defineEmits(['drill'])

// The categorical ramp in design tokens; all SOLID mid-tones, since the pale surface-*-1 steps carry a dark-mode alpha echarts cannot parse.
const SERIES_TOKENS = [
  '--surface-blue-2',
  '--surface-green-3',
  '--surface-amber-2',
  '--surface-red-4',
  '--text-ink-violet-1',
  '--text-ink-cyan-1',
  '--outline-orange-1',
  '--text-ink-pink-1',
  '--surface-gray-5',
]

// The tokens hold space-separated RGB channels ("2 137 247"), which echarts cannot read as a colour.
function tokenColour(name) {
  const channels = cssToken(name)
  return channels ? `rgb(${channels})` : ''
}

const palette = computed(() => {
  // Naming `theme` is what re-reads the tokens on a light/dark flip — cssToken reads the DOM, not a ref.
  void theme.value
  return SERIES_TOKENS.map(tokenColour).filter(Boolean)
})

const axisInk = computed(() => {
  void theme.value
  return tokenColour('--text-ink-gray-5')
})

const gridLine = computed(() => {
  void theme.value
  return tokenColour('--outline-gray-1')
})

const points = computed(() => props.chart.points || [])
const hasPoints = computed(() => points.value.length > 0)

// A card whose declaration has drill turned off carries no `drill` on any point, and must not pretend.
const drillable = computed(() => points.value.some((point) => point.drill?.route))
const cursor = computed(() => (drillable.value ? 'pointer' : 'default'))

const options = computed(() =>
  props.chart.type === 'bar' ? barOptions() : donutOptions(),
)

function donutOptions() {
  return {
    color: palette.value,
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      type: 'scroll',
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: axisInk.value, fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        cursor: cursor.value,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderWidth: 0 },
        data: points.value.map((point) => ({
          name: point.label,
          value: point.value,
        })),
      },
    ],
  }
}

function barOptions() {
  return {
    color: palette.value,
    tooltip: { trigger: 'item' },
    grid: { left: 4, right: 12, top: 16, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.value.map((point) => point.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: gridLine.value } },
      axisLabel: { color: axisInk.value, fontSize: 11, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      // Compact on the axis, exact in the tooltip: at a million tasks "1.2M" is a label and 1200000 is not.
      axisLabel: { color: axisInk.value, fontSize: 11, formatter: formatCount },
      splitLine: { lineStyle: { color: gridLine.value } },
    },
    series: [
      {
        type: 'bar',
        colorBy: 'data',
        cursor: cursor.value,
        barMaxWidth: 48,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        data: points.value.map((point) => point.value),
      },
    ],
  }
}

// A legend click carries no `dataIndex`, so it resolves to no point and emits nothing — which is right.
const events = computed(() => ({
  click: (params) => {
    const point = points.value[params?.dataIndex]
    if (point?.drill?.route) emit('drill', point.drill)
  },
}))
</script>
