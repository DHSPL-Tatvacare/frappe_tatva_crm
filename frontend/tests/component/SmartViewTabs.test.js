// Purpose: the desktop Smart View strip renders one tab per view, marks the active one, and is the
// parent's selection source of truth — clicking a tab emits update:modelValue(name) and the "+" emits
// create. These emit contracts are what wires the strip to the route + the create flow (A.17 engine UI).
import { describe, it, expect, vi } from 'vitest'
import { mountTatva } from './_mount.js'

vi.mock('@/stores/smartViews', () => ({
  smartViewsStore: () => ({ getCount: () => null }), // no count pills in this unit
}))

import SmartViewTabs from '@/tatva/SmartViewTabs.vue'

const views = [
  { name: 'sv-leads', label: 'My Leads', base_object: 'Lead' },
  { name: 'sv-acts', label: 'Open Tasks', base_object: 'Activity' },
]

describe('SmartViewTabs', () => {
  it('renders a tab per view', () => {
    const wrapper = mountTatva(SmartViewTabs, { props: { views, modelValue: 'sv-leads' } })
    expect(wrapper.text()).toContain('My Leads')
    expect(wrapper.text()).toContain('Open Tasks')
  })

  it('emits update:modelValue with the clicked view name', async () => {
    const wrapper = mountTatva(SmartViewTabs, { props: { views, modelValue: 'sv-leads' } })
    const tabs = wrapper.findAll('button[title]')
    await tabs[1].trigger('click') // "Open Tasks"
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['sv-acts'])
  })

  it('emits create when the add-view button is clicked', async () => {
    const wrapper = mountTatva(SmartViewTabs, { props: { views, modelValue: 'sv-leads' } })
    await wrapper.get('button[aria-label="Add view"]').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })
})
