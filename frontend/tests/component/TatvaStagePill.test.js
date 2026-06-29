// Purpose: the lead-header stage button resolves options from ONE server method (scoped to the lead's
// program) and shows the chosen substage's display_label — the composite `::` PK must never reach the
// UI. Picking emits 'change' with the leaf name the parent writes. Data is mocked at the network layer
// with MSW (frappe-ui's own test convention), so this exercises the real createResource path.
import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'
import TatvaStagePill from '@/tatva/TatvaStagePill.vue'

const stages = [
  { name: 'GoodFlip::Anaya::Nivolumab::Screening', display_label: 'Screening', color: 'blue' },
  { name: 'GoodFlip::Anaya::Nivolumab::Enrolled', display_label: 'Enrolled', color: 'green' },
]

describe('TatvaStagePill', () => {
  it('shows the current substage display_label, never the :: PK', async () => {
    mockFrappeMethod('tatva_connect.lead.leads.lead_stages', stages)
    const wrapper = mountTatva(TatvaStagePill, {
      props: { lead: 'LEAD-1', modelValue: 'GoodFlip::Anaya::Nivolumab::Enrolled' },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Enrolled')
    expect(wrapper.text()).not.toContain('::')
  })

  it('falls back to "Set stage" when modelValue matches no option', async () => {
    mockFrappeMethod('tatva_connect.lead.leads.lead_stages', stages)
    const wrapper = mountTatva(TatvaStagePill, { props: { lead: 'LEAD-1', modelValue: '' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Set stage')
  })
})
