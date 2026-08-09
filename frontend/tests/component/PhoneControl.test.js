// Purpose: the country picker is a SEARCHABLE list, not a 240-row native select — and the closed trigger
// carries only what a rep needs while typing digits (the flag and the dial code), so it stays as narrow as
// its contents. The flag is derived from the ISO-3166 alpha-2 the server already sends as `region`; no icon
// set and no country list live in the client. Picking a country recomposes the value, which is the only
// thing this control writes.
//
// Data is mocked at the network layer with MSW (frappe-ui's own convention), so the real dialCodes
// resource path runs. Autocomplete is stubbed locally for the same reason TatvaStagePill's spec stubs it:
// the real one renders #target inside frappe-ui's <Popover>, whose shared stub forwards only the
// default/#body slots, so the trigger would never render. The stub also lists the options, which is where
// the searchable label and the per-row flag are asserted.
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

const AutocompleteStub = {
  name: 'Autocomplete',
  props: ['options', 'modelValue', 'maxOptions', 'bodyClasses', 'placement'],
  emits: ['change'],
  template: `<div data-stub="autocomplete">
    <slot name="target" :togglePopover="() => {}" :isOpen="false" />
    <ul>
      <li v-for="o in options" :key="o.value" :data-value="o.value">
        <slot name="item-prefix" :option="o" />{{ o.label }}
      </li>
    </ul>
  </div>`,
}

async function mountPhone(props = {}) {
  mockFrappeMethod('tatva_connect.whatsapp.phone.dial_codes', CODES)
  const wrapper = mountTatva(PhoneControl, {
    props,
    global: { stubs: { Autocomplete: AutocompleteStub } },
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

function optionRow(wrapper, dial) {
  return wrapper.find(`li[data-value="${dial}"]`)
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
    // Both halves are in the label, which is what Autocomplete's own filter matches on.
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
    wrapper.findComponent({ name: 'Autocomplete' }).vm.$emit('change', { value: '+966' })
    await flushPromises()
    expect(wrapper.emitted('change').at(-1)).toEqual(['+9669876543210'])
  })

  it('keeps a dial code when the picker is cleared, so the value never loses its country', async () => {
    const wrapper = await mountPhone({ value: '+919876543210' })
    wrapper.findComponent({ name: 'Autocomplete' }).vm.$emit('change', null)
    await flushPromises()
    expect(wrapper.emitted('change').at(-1)).toEqual(['+919876543210'])
  })
})
