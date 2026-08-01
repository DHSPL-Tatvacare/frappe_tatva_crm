<!--
  TatvaChart — the ONE grouped-chart renderer on the dashboard. Donut and bar, from the same payload.

  It renders frappe-ui's OWN DonutChart / AxisChart, so the palette, tooltip, legend, axis and theme are
  theirs and this file states none of them. The only thing it adds is the click: those two components
  never forward the `events` prop that ECharts supports, so a slice cannot be clicked. echarts' public
  `getInstanceByDom` reaches the instance they already created and attaches one listener — the minimum
  needed, rather than rebuilding a chart in order to get a handler.

  A click resolves by LABEL, never by index: donutChartOptions sorts its data by value before drawing, so
  a positional lookup would open somebody else's slice.
-->
<template>
  <div ref="host" class="h-full w-full">
    <DonutChart v-if="hasPoints && chart.type === 'donut'" :config="donutConfig" />
    <AxisChart v-else-if="hasPoints" :config="barConfig" />
    <div
      v-else
      class="flex h-full w-full items-center justify-center px-4 text-center text-p-sm text-ink-gray-5"
    >
      {{ __('Nothing to show for this range') }}
    </div>
  </div>
</template>

<script setup>
import { AxisChart, DonutChart } from 'frappe-ui'
import { getInstanceByDom } from 'echarts'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  chart: { type: Object, required: true },
})

const emit = defineEmits(['drill'])

const host = ref(null)
const points = computed(() => props.chart.points || [])
const hasPoints = computed(() => points.value.length > 0)
// A chart whose points carry no drill must not pretend to be clickable.
const cursor = computed(() =>
  points.value.some((one) => one.drill?.route) ? 'pointer' : 'default',
)

const rows = computed(() =>
  points.value.map((point) => ({ label: point.label, value: point.value })),
)

const donutConfig = computed(() => ({
  data: rows.value,
  title: '',
  categoryColumn: 'label',
  valueColumn: 'value',
}))

const barConfig = computed(() => ({
  data: rows.value,
  title: '',
  xAxis: { key: 'label', type: 'category' },
  // eChartOptions renders `↑ ${title}` unguarded, so omitting it draws the literal "↑ undefined".
  yAxis: { title: '' },
  // In the option, not on the instance: axisChartOptions merges it, so a redraw cannot drop it.
  series: [{ name: 'value', type: 'bar', echartOptions: { cursor: cursor.value } }],
}))

function onSliceClick(params) {
  const point = points.value.find((one) => one.label === params?.name)
  if (point?.drill?.route) emit('drill', point.drill)
}

let instance = null

function attach() {
  const el = host.value?.querySelector('div')
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
watch(() => [props.chart.type, props.chart.points], () => nextTick(attach), { deep: true })
onBeforeUnmount(() => instance?.off('click', onSliceClick))
</script>
