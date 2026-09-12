// Purpose: the chevron is positioned OVER the trigger's row, so whatever sits in that row must reserve its
// width. The EMPTY state did (`pr-7`) and the FILLED state, one line below it in the same file, did not —
// so an empty box looked correct while `Inclusions or additional services were promised` ran under the
// arrow. Sixteen call sites read this trigger.
//
// Asserted on the RENDERED row rather than by scanning the source, because only the render knows which row
// actually sits under the icon: a file-level scan flags every unrelated `truncate` in the same component.
// The rule is stated as a comparison — filled reserves what empty reserves — so it cannot be satisfied by
// hard-coding one number that a later redesign changes.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'

const OPTIONS = [
  { label: 'Inclusions or additional services were promised', value: 'long' },
  { label: 'Short', value: 'short' },
]

const rightPad = (cls) => (String(cls || '').match(/\b(pr-\d+|px-\d+)\b/) || [])[0] || null

// The row the trigger renders for its current state — the one the chevron floats over.
function triggerRow(wrapper) {
  const button = wrapper.find('button')
  expect(button.exists()).toBe(true)
  const row = button.element.querySelector('div')
  expect(row).toBeTruthy()
  return row.getAttribute('class')
}

describe('Autocomplete trigger — the chevron never covers the value', () => {
  it('reserves the icon’s width when a value is chosen', () => {
    const w = mount(Autocomplete, { props: { options: OPTIONS, modelValue: 'long' } })
    expect(rightPad(triggerRow(w))).toBeTruthy()
  })

  it('reserves the SAME width whether a value is chosen or not', () => {
    const filled = mount(Autocomplete, { props: { options: OPTIONS, modelValue: 'long' } })
    const empty = mount(Autocomplete, { props: { options: OPTIONS, modelValue: '' } })
    expect(rightPad(triggerRow(filled))).toBe(rightPad(triggerRow(empty)))
  })

  it('still truncates, so reserving the width cannot be done by letting the row grow', () => {
    const w = mount(Autocomplete, { props: { options: OPTIONS, modelValue: 'long' } })
    expect(triggerRow(w)).toContain('truncate')
  })
})
