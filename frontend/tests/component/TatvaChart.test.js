// Purpose: frappe-ui's DonutChart and AxisChart render `<ECharts>` without ever forwarding its `events`
// prop, so a slice in either of them cannot be clicked — and their options builders are unreachable
// through the package's exports map. This wrapper builds the options itself, and the ONE thing it must
// never get wrong is the index: `params.dataIndex` points into the array WE handed echarts, so if the
// series data were re-sorted after building, every drill click would open somebody else's slice.
import { describe, expect, it, vi } from 'vitest'
import { mountTatva } from './_mount.js'
import TatvaChart from '@/tatva/TatvaChart.vue'

// vi.hoisted: vi.mock is lifted above the file's imports, so its factory cannot close over an ordinary
// const. Only `ECharts` is replaced — `@/utils` and the MSW setup still need the real module.
const EChartsStub = vi.hoisted(() => ({
  name: 'EChartsStub',
  props: {
    options: { type: Object, default: () => ({}) },
    events: { type: Object, default: () => ({}) },
    error: { type: String, default: '' },
    class: { type: String, default: '' },
  },
  template: '<div data-stub="ECharts" />',
}))

vi.mock('frappe-ui', async (importOriginal) => ({
  ...(await importOriginal()),
  ECharts: EChartsStub,
}))

const drillFor = (source) => ({
  doctype: 'CRM Lead',
  route: 'Leads',
  filters: { creation: ['between', ['2026-07-01', '2026-07-31']], source },
})

// Deliberately NOT in descending order — the backend already decided the order and this must keep it.
const points = [
  { label: 'Not set', raw: null, value: 91, drill: drillFor(['is', 'not set']) },
  { label: 'Cold Call', raw: 'Cold Call', value: 12, drill: drillFor('Cold Call') },
  { label: 'Referral', raw: 'Referral', value: 44, drill: drillFor('Referral') },
]

function mountChart(chart = {}) {
  return mountTatva(TatvaChart, {
    props: {
      chart: {
        chart: 'leads_by_source',
        type: 'donut',
        label: 'Leads by Source',
        subtitle: 'Where they came from',
        value: 147,
        points,
        ...chart,
      },
    },
  })
}

const echarts = (wrapper) => wrapper.findComponent({ name: 'EChartsStub' })

describe('TatvaChart', () => {
  it('a donut series carries one entry per point, in the payload order', () => {
    const data = echarts(mountChart()).props('options').series[0].data
    expect(data).toEqual([
      { name: 'Not set', value: 91 },
      { name: 'Cold Call', value: 12 },
      { name: 'Referral', value: 44 },
    ])
  })

  it('a click emits the drill of the point at that dataIndex, not of a re-sorted one', () => {
    const wrapper = mountChart()
    echarts(wrapper).props('events').click({ dataIndex: 1 })
    expect(wrapper.emitted('drill')).toEqual([[drillFor('Cold Call')]])
  })

  it('the blank group drills on the backend\'s own "is not set", never on the label', () => {
    const wrapper = mountChart()
    echarts(wrapper).props('events').click({ dataIndex: 0 })
    expect(wrapper.emitted('drill')[0][0].filters.source).toEqual(['is', 'not set'])
  })

  it('a point with no drill emits nothing — a card with drill turned off must not navigate', () => {
    const wrapper = mountChart({
      points: [{ label: 'Cold Call', raw: 'Cold Call', value: 12 }],
    })
    echarts(wrapper).props('events').click({ dataIndex: 0 })
    expect(wrapper.emitted('drill')).toBeUndefined()
  })

  it('a legend click, which carries no dataIndex, resolves to no point and emits nothing', () => {
    const wrapper = mountChart()
    echarts(wrapper).props('events').click({ componentType: 'legend', name: 'Referral' })
    expect(wrapper.emitted('drill')).toBeUndefined()
  })

  it('the pointer cursor is drawn only where a click really navigates', () => {
    expect(echarts(mountChart()).props('options').series[0].cursor).toBe('pointer')
    const inert = mountChart({ points: [{ label: 'Cold Call', raw: 'Cold Call', value: 12 }] })
    expect(echarts(inert).props('options').series[0].cursor).toBe('default')
  })

  it('a bar chart reads the same points into a category axis and one series', () => {
    const options = echarts(mountChart({ type: 'bar' })).props('options')
    expect(options.xAxis.data).toEqual(['Not set', 'Cold Call', 'Referral'])
    expect(options.series[0].type).toBe('bar')
    expect(options.series[0].data).toEqual([91, 12, 44])
  })

  it('a bar click still indexes our own array', () => {
    const wrapper = mountChart({ type: 'bar' })
    echarts(wrapper).props('events').click({ dataIndex: 2 })
    expect(wrapper.emitted('drill')).toEqual([[drillFor('Referral')]])
  })

  it('no points means a said-out-loud empty state, not an empty chart frame', () => {
    const wrapper = mountChart({ points: [] })
    expect(echarts(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toContain('Nothing to show for this range')
  })

  // ECharts.vue defaults to `min-w-[300px] md:min-w-[400px] min-h-[300px]`, which is a flat width at
  // every breakpoint and overflows a grid tile on a phone. The class prop REPLACES that default.
  it('overrides the library min-widths so a tile can shrink on a phone', () => {
    expect(echarts(mountChart()).props('class')).not.toContain('min-w-')
  })
})
