import { describe, it, expect } from 'vitest'
import { FormControl } from 'frappe-ui'
import { mountTatva } from './_mount'
import ValueInput from '@/tatva/ValueInput.vue'

// ONE value and how it is filled — the block that existed in FieldMap and ValueMap and was about to exist
// a third time for a Wait's instant. What is under test is the ONE decision it makes: which editor a mode
// gets. That answer is the backend's (`mode_controls`), and these tests exist so the control can never
// start answering it from the POSITION of a mode in a list the backend is free to reorder — which is what
// `ValueMap.vue` did (`modes[1]`) and what nothing in Python could have caught.
const MODES = ['Literal', 'From Context', 'Expression', 'Increment by']
const MODE_CONTROLS = {
  Literal: 'data',
  'From Context': 'value-picker',
  Expression: 'textarea',
  'Increment by': 'number',
}
const VALUE_ROWS = [
  { label: 'First name', value: 'crm_lead.first_name', group: 'Lead', description: 'crm_lead.first_name' },
]

function mountWith(modelValue, overrides = {}) {
  return mountTatva(ValueInput, {
    props: { modelValue, modes: MODES, modeControls: MODE_CONTROLS, valueRows: VALUE_ROWS, ...overrides },
  })
}

const lastEmit = (w) => w.emitted('update:modelValue').at(-1)[0]

// The mode switch is frappe-ui's `FormControl type="select"`, which in this version is a Reka combobox —
// a `<button role="combobox">` with a TELEPORTED listbox, not a native `<select>`, and it swallows a
// fallthrough attribute so it cannot be hooked by one either. Driving it through its declared emit tests
// the handler under test rather than a third party's DOM.
function pickMode(w, mode) {
  const select = w.findAllComponents(FormControl).find((c) => c.props('type') === 'select')
  return select.vm.$emit('update:modelValue', mode)
}

describe('ValueInput — the declaration says which editor a mode gets', () => {
  it('draws each mode the input the DECLARATION names for it', () => {
    for (const [mode, control] of Object.entries(MODE_CONTROLS)) {
      const w = mountWith({ mode, value: '' })
      expect(w.find(`[data-test="value-input-${control}"]`).exists()).toBe(true)
    }
    expect(mountWith({ mode: 'Increment by', value: 1 }).find('input[type="number"]').exists()).toBe(true)
    expect(mountWith({ mode: 'Expression', value: 'x' }).find('textarea').exists()).toBe(true)
  })

  it('is not fooled by mode ORDER — the control follows the map, not the position', () => {
    // The same value, with the declaration's list reversed. A component reading `modes[1]` for the picker
    // would draw the wrong input here and nothing would say so.
    const w = mountWith({ mode: 'Increment by', value: 1 }, { modes: [...MODES].reverse() })
    expect(w.find('[data-test="value-input-number"]').exists()).toBe(true)
  })

  it('draws a calendar when the declaration asks for one', () => {
    // A Wait's instant: the same field offers a moment on the calendar AND a value the run is carrying,
    // and only the declaration knows that its literal is a date rather than typed text.
    const w = mountWith(
      { mode: 'Literal', value: '2026-08-10 09:00:00' },
      { modeControls: { ...MODE_CONTROLS, Literal: 'datetime' } },
    )
    expect(w.find('[data-test="value-input-datetime"]').exists()).toBe(true)
    expect(w.find('[data-test="value-input-data"]').exists()).toBe(false)
  })

  it('clears the value when the mode changes', async () => {
    // A reference left behind would be WRITTEN as text onto a patient's field; a typed value left behind
    // would be READ as a reference to something nothing produces.
    const w = mountWith({ mode: 'From Context', value: 'crm_lead.first_name' })
    await pickMode(w, 'Literal')
    expect(lastEmit(w)).toEqual({ mode: 'Literal', value: '' })
  })

  it('keeps the mode when only the value changes', async () => {
    const w = mountWith({ mode: 'Literal', value: '' })
    await w.find('input[data-test="value-input-data"]').setValue('Open')
    expect(lastEmit(w)).toEqual({ mode: 'Literal', value: 'Open' })
  })

  it('disables its controls when the node is not editable', () => {
    const enabled = mountWith({ mode: 'Literal', value: 'Open' })
    const disabled = mountWith({ mode: 'Literal', value: 'Open' }, { disabled: true })
    // The attribute lands ON the input: frappe-ui's text FormControl passes fallthrough attrs to it.
    expect(enabled.find('input[data-test="value-input-data"]').attributes('disabled')).toBeUndefined()
    expect(disabled.find('input[data-test="value-input-data"]').attributes('disabled')).toBeDefined()
  })
})
