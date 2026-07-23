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

// The pill's trigger (the Button showing currentLabel) lives in Autocomplete's #target slot. The real
// Autocomplete renders #target inside frappe-ui's <Popover>, whose shared stub (_mount.js) forwards only
// the default/#body slots — so the trigger and its label never render, and wrapper.text() showed only the
// option list. Stub Autocomplete locally to render #target directly, so the label under test is asserted.
const AutocompleteStub = {
  name: 'Autocomplete',
  props: ['options', 'modelValue', 'maxOptions', 'placement'],
  emits: ['change'],
  template: `<div data-stub="autocomplete"><slot name="target" :togglePopover="() => {}" :isOpen="false" /></div>`,
}

describe('TatvaStagePill', () => {
  it('shows the current substage display_label, never the :: PK', async () => {
    mockFrappeMethod('tatva_connect.lead.leads.lead_stages', stages)
    const wrapper = mountTatva(TatvaStagePill, {
      props: { lead: 'LEAD-1', modelValue: 'GoodFlip::Anaya::Nivolumab::Enrolled' },
      global: { stubs: { Autocomplete: AutocompleteStub } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Enrolled')
    expect(wrapper.text()).not.toContain('::')
  })

  it('falls back to "Set stage" when modelValue matches no option', async () => {
    mockFrappeMethod('tatva_connect.lead.leads.lead_stages', stages)
    const wrapper = mountTatva(TatvaStagePill, {
      props: { lead: 'LEAD-1', modelValue: '' },
      global: { stubs: { Autocomplete: AutocompleteStub } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Set stage')
  })
})
