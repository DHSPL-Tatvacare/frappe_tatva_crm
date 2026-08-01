<!--
  TatvaChart — the ONE grouped-chart renderer on the dashboard. Every kind, from the same payload.

  It renders frappe-ui's OWN DonutChart / AxisChart / ECharts, so the palette, tooltip, legend, axis and
  theme are theirs and this file states none of them. AxisChart already takes `stacked` and a per-series
  type, so a bar, a line and a stack are one component handed different config — there is no second
  component here and no chart is rebuilt to get one.

  The only thing it adds is the click: DonutChart and AxisChart never forward the `events` prop that
  ECharts supports, so a slice cannot be clicked. echarts' public `getInstanceByDom` reaches the instance
  they already created and attaches one listener. The heatmap needs none of that — it renders ECharts
  itself, which takes `events` as a prop.

  A click resolves by LABEL, never by index: donutChartOptions sorts its data by value before drawing, so
  a positional lookup would open somebody else's slice. A cell of a split card carries its own drill,
  holding BOTH dimensions; where the payload gives a datapoint no drill, nothing is clickable and the
  cursor says so.
-->
<template>
  <div ref="host" class="h-full w-full">
    <DonutChart v-if="hasPoints && chart.type === 'donut'" :config="donutConfig" />
    <ECharts
      v-else-if="hasPoints && chart.type === 'heatmap'"
      :options="heatmapOptions"
      :events="{ click: onHeatmapClick }"
    />
    <AxisChart v-else-if="hasPoints" :config="axisConfig" />
    <div
      v-else
      class="flex h-full w-full items-center justify-center px-4 text-center text-p-sm text-ink-gray-5"
    >
      {{ __('Nothing to show for this range') }}
    </div>
  </div>
</template>

<script setup>
import { AxisChart, DonutChart, ECharts } from 'frappe-ui'
import { getInstanceByDom } from 'echarts'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  chart: { type: Object, required: true },
})

const emit = defineEmits(['drill'])

const host = ref(null)
const points = computed(() => props.chart.points || [])
// `series` is added by the server only where the card declared a second dimension; absent, nothing changes.
const series = computed(() => props.chart.series || [])
const split = computed(() => series.value.length > 0)
const hasPoints = computed(() => points.value.length > 0)
// A chart whose datapoints carry no drill must not pretend to be clickable.
const cursor = computed(() =>
  points.value.some((one) => one.drill?.route) ||
  series.value.some((one) => (one.points || []).some((cell) => cell.drill?.route))
    ? 'pointer'
    : 'default',
)

// Matched on `raw`, never on position: the axis is merged and re-sorted server-side for blanks.
function cellOf(one, point) {
  return (one.points || []).find((cell) => cell.raw === point.raw)
}

const rows = computed(() =>
  split.value
    ? points.value.map((point) => ({
        label: point.label,
        ...Object.fromEntries(
          series.value.map((one) => [one.name, cellOf(one, point)?.value ?? 0]),
        ),
      }))
    : points.value.map((point) => ({ label: point.label, value: point.value })),
)

const donutConfig = computed(() => ({
  data: rows.value,
  title: '',
  categoryColumn: 'label',
  valueColumn: 'value',
}))

// A line card draws lines, everything else bars; frappe-ui's AxisChart takes the type per series.
const seriesType = computed(() => (props.chart.type === 'line' ? 'line' : 'bar'))

const axisConfig = computed(() => ({
  data: rows.value,
  title: '',
  xAxis: { key: 'label', type: 'category' },
  // eChartOptions renders `↑ ${title}` unguarded, so omitting it draws the literal "↑ undefined".
  yAxis: { title: '' },
  // axisChartOptions turns this into echarts' own `stack`, so nothing here stacks anything by hand.
  stacked: props.chart.type === 'stacked_bar',
  // In the option, not on the instance: axisChartOptions merges it, so a redraw cannot drop it.
  series: split.value
    ? series.value.map((one) => ({
        name: one.name,
        type: seriesType.value,
        echartOptions: { cursor: cursor.value },
      }))
    : [{ name: 'value', type: seriesType.value, echartOptions: { cursor: cursor.value } }],
}))

const heatmapOptions = computed(() => {
  const axis = points.value.map((point) => point.label)
  const cells = []
  let most = 0
  series.value.forEach((one, y) => {
    points.value.forEach((point, x) => {
      const value = cellOf(one, point)?.value ?? 0
      most = Math.max(most, value)
      cells.push([x, y, value])
    })
  })
  return {
    tooltip: { position: 'top' },
    grid: { left: 8, right: 8, top: 8, bottom: 48, containLabel: true },
    xAxis: { type: 'category', data: axis, splitArea: { show: true } },
    yAxis: {
      type: 'category',
      data: series.value.map((one) => one.name),
      splitArea: { show: true },
    },
    // A legend, not a control: `calculable` draws a drag handle, and nothing on this dashboard is editable.
    // `max` never zero — echarts draws no colour scale over an empty range and the whole grid reads blank.
    visualMap: {
      min: 0,
      max: most || 1,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 90,
    },
    series: [{ type: 'heatmap', data: cells, label: { show: true }, cursor: cursor.value }],
  }
})

function onSliceClick(params) {
  const label = params?.name ?? params?.value?.[0]
  const point = points.value.find((one) => one.label === label)
  const line = series.value.find((one) => one.name === params?.seriesName)
  // The cell first: it carries both dimensions, where the axis point carries only its own.
  const drill = (line?.points || []).find((one) => one.label === label)?.drill || point?.drill
  if (drill?.route) emit('drill', drill)
}

function onHeatmapClick(params) {
  const [x, y] = params?.value || []
  const drill = cellOf(series.value[y] || {}, points.value[x] || {})?.drill
  if (drill?.route) emit('drill', drill)
}

let instance = null

function attach() {
  // The heatmap is our own ECharts and already has its handler; attaching here would drill the axis instead.
  if (props.chart.type === 'heatmap') return
  // The element echarts ITSELF marks, never a guess at which descendant div it chose: frappe-ui wraps its
  // charts several levels deep, and `querySelector('div')` found a wrapper — so nothing was ever bound.
  const el = host.value?.querySelector('[_echarts_instance_]')
  const found = el && getInstanceByDom(el)
  if (!found || found === instance) return
  instance?.off('click', onSliceClick)
  instance = found
  instance.on('click', onSliceClick)
  // donutChartOptions ignores echartOptions, so only the donut's cursor must be re-set after a redraw.
  if (props.chart.type === 'donut' && cursor.value === 'pointer') {
    instance.setOption({ series: [{ cursor: 'pointer' }] })
  }
}

onMounted(() => nextTick(attach))
// The chart is recreated when the card switches type or first receives data, so re-attach after a redraw.
watch(
  () => [props.chart.type, props.chart.points, props.chart.series],
  () => nextTick(attach),
  { deep: true },
)
onBeforeUnmount(() => instance?.off('click', onSliceClick))
</script>
