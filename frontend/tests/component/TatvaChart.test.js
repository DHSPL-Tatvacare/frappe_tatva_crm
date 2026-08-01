// Purpose: the dashboard's grouped charts ARE frappe-ui's DonutChart / AxisChart. This component only maps
// the backend's uniform `points[]` onto their config and adds the one thing those two never forward — the
// click on a slice.
//
// What is provable here is the MAPPING and the CHOICE: donut vs bar, the rows handed over, the empty state,
// and that nothing about colour, tooltip or legend is stated by us — that belongs to frappe-ui, and an
// earlier version of this file re-declared all of it and shipped invalid colours nobody could see.
//
// The click is attached to a live echarts instance through `getInstanceByDom`, which needs a real renderer.
// It is proved in the browser pass, NOT stubbed here — a stub would only assert our own mock back to us.
import { describe, expect, it } from 'vitest'
import { mountTatva } from './_mount.js'
import TatvaChart from '@/tatva/TatvaChart.vue'

const donut = {
  chart: 'leads_by_source',
  type: 'donut',
  points: [
    {
      label: 'Referral',
      raw: 'Referral',
      value: 12,
      drill: { route: 'Leads', filters: { source: 'Referral' } },
    },
    {
      label: 'Not set',
      raw: null,
      value: 5,
      drill: { route: 'Leads', filters: { source: ['is', 'not set'] } },
    },
  ],
}

const bar = { ...donut, chart: 'tasks_by_status', type: 'bar' }

const stubs = {
  DonutChart: { name: 'DonutChart', props: ['config'], template: '<div data-chart="donut" />' },
  AxisChart: { name: 'AxisChart', props: ['config'], template: '<div data-chart="axis" />' },
}

const mount = (chart) => mountTatva(TatvaChart, { props: { chart }, global: { stubs } })

describe('TatvaChart', () => {
  it('renders frappe-ui DonutChart for a donut and AxisChart for a bar', () => {
    expect(mount(donut).find('[data-chart="donut"]').exists()).toBe(true)
    expect(mount(bar).find('[data-chart="axis"]').exists()).toBe(true)
  })

  it('hands the points over as label/value rows, in the order the backend ordered them', () => {
    const config = mount(donut).findComponent({ name: 'DonutChart' }).props('config')
    expect(config.data).toEqual([
      { label: 'Referral', value: 12 },
      { label: 'Not set', value: 5 },
    ])
    expect(config.categoryColumn).toBe('label')
    expect(config.valueColumn).toBe('value')
  })

  it('states nothing about colour or tooltip — those belong to frappe-ui', () => {
    const config = mount(donut).findComponent({ name: 'DonutChart' }).props('config')
    expect(config.colors).toBeUndefined()
    expect(config.echartOptions).toBeUndefined()
  })

  it('names the bar axis by the label column, and titles the y-axis so it is not drawn as undefined', () => {
    const config = mount(bar).findComponent({ name: 'AxisChart' }).props('config')
    expect(config.xAxis).toMatchObject({ key: 'label', type: 'category' })
    // eChartOptions renders `↑ ${title}` unguarded; omitting it drew the literal "↑ undefined".
    expect(config.yAxis.title).toBe('')
    // Its scale is frappe-ui's own compact formatValue — overriding it made the axis disagree with tooltips.
    expect(config.yAxis.echartOptions).toBeUndefined()
  })

  it('marks a drillable series with a pointer cursor through the option, not the instance', () => {
    const config = mount(bar).findComponent({ name: 'AxisChart' }).props('config')
    expect(config.series[0].echartOptions.cursor).toBe('pointer')
    const noDrill = { ...bar, points: bar.points.map(({ drill, ...rest }) => rest) }
    const plain = mount(noDrill).findComponent({ name: 'AxisChart' }).props('config')
    expect(plain.series[0].echartOptions.cursor).toBe('default')
  })

  it('says so plainly when a card has nothing to show, instead of drawing an empty chart', () => {
    const wrapper = mount({ ...donut, points: [] })
    expect(wrapper.find('[data-chart="donut"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nothing to show for this range')
  })
})
