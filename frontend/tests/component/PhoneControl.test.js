// Purpose: the country picker is a SEARCHABLE list, not a 240-row native select — and the closed trigger
// carries only what a rep needs while typing digits (the flag and the dial code), so it stays as narrow as
// its contents. The flag is derived from the ISO-3166 alpha-2 the server already sends as `region`; no icon
// set and no country list live in the client. Picking a country recomposes the value, which is the only
// thing this control writes.
//
// Data is mocked at the network layer with MSW (frappe-ui's own convention), so the real dialCodes
// resource path runs. Popover is stubbed locally because the shared overlay stub forwards only the
// default/#body slots, and the trigger lives in #target — so it would never render.
import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'
import PhoneControl from '@/components/Controls/PhoneControl.vue'

const CODES = [
  { country: 'India', region: 'IN', dial: '+91', default: 1 },
  { country: 'Saudi Arabia', region: 'SA', dial: '+966', default: 0 },
  { country: 'Nowhere', region: '', dial: '+999', default: 0 },
]

const PopoverStub = {
  name: 'Popover',
  template: `<div data-stub="popover">
    <slot name="target" :togglePopover="() => {}" />
    <slot name="body" :close="() => {}" />
  </div>`,
}

async function mountPhone(props = {}) {
  mockFrappeMethod('tatva_connect.whatsapp.phone.dial_codes', CODES)
  const wrapper = mountTatva(PhoneControl, {
    props,
    global: { stubs: { Popover: PopoverStub } },
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

// A row is found by the dial code it shows, because the list carries no key of its own in the markup.
function optionRow(wrapper, dial) {
  return wrapper.findAll('li').find((li) => li.text().includes(dial))
}

describe('PhoneControl country picker', () => {
  it('shows the flag and the dial code on the trigger, and NOT the country name', async () => {
    const wrapper = await mountPhone({ value: '+919876543210' })
    const trigger = wrapper.find('button')
    expect(trigger.text()).toContain('+91')
    expect(trigger.text()).toContain('🇮🇳')
    // The country name belongs in the list, not in the closed trigger — that name is what made it wide.
    expect(trigger.text()).not.toContain('India')
  })

  it('offers every country, each with its own flag and a label that carries code AND name', async () => {
    const wrapper = await mountPhone({ value: '' })
    expect(wrapper.findAll('li')).toHaveLength(CODES.length)
    // Both halves are on the row, which is what the picker's own search matches on.
    expect(optionRow(wrapper, '+966').text()).toContain('+966')
    expect(optionRow(wrapper, '+966').text()).toContain('Saudi Arabia')
    expect(optionRow(wrapper, '+966').text()).toContain('🇸🇦')
  })

  it('renders a country with no region rather than a broken glyph', async () => {
    const wrapper = await mountPhone({ value: '' })
    const row = optionRow(wrapper, '+999')
    expect(row.text()).toContain('Nowhere')
    expect(row.text()).not.toContain('🏴')
  })

  it('recomposes the number when another country is picked', async () => {
    const wrapper = await mountPhone({ value: '+919876543210' })
    await optionRow(wrapper, '+966').find('button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('change').at(-1)).toEqual(['+9669876543210'])
  })

  it('takes the first match on Enter, so a search that names one country needs no click', async () => {
    const wrapper = await mountPhone({ value: '+919876543210' })
    await wrapper.find('input[placeholder="Search"]').setValue('Saudi')
    await wrapper.find('input[placeholder="Search"]').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.emitted('change').at(-1)).toEqual(['+9669876543210'])
  })

  it('picks nothing when the search matches nothing, so the value never loses its country', async () => {
    const wrapper = await mountPhone({ value: '+919876543210' })
    await wrapper.find('input[placeholder="Search"]').setValue('zzzz')
    expect(wrapper.findAll('li')).toHaveLength(1) // the empty state, and no country to take
    await wrapper.find('input[placeholder="Search"]').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
