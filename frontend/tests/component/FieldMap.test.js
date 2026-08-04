import { describe, it, expect } from 'vitest'
import { FormControl } from 'frappe-ui'
import { mountTatva } from './_mount'
import FieldMap from '@/tatva/workflows/FieldMap.vue'

// W8.1 — the control an Update Field node is authored with. Value Map's twin, and deliberately NOT Value
// Map: there the rows are a template's blanks (enumerated, fixed, un-addable), here the author names them.
// `ValueMap.vue`'s `write()` rebuilds its model from the fetched slot list, so an authored row would be
// deleted on the next keystroke — which is why this is its own component and why the first test below is
// "a row can be added at all".
//
// The words are the BACKEND's, passed in, never spelled here: `modes` is what an author picks from and
// `mode_controls` says which input each one gets. A positional `modes[2]` would be this file deciding what
// a mode MEANS, in the one place a Python lock cannot reach.
const MODES = ['Literal', 'From Context', 'Expression', 'Increment by']
const MODE_CONTROLS = {
  Literal: 'data',
  'From Context': 'value-picker',
  Expression: 'textarea',
  'Increment by': 'number',
}

const FIELD_ROWS = [
  { label: 'Status', value: 'status', group: 'CRM Lead', description: 'status' },
  { label: 'Sub-stage', value: 'custom_substage', group: 'CRM Lead', description: 'custom_substage' },
]
const VALUE_ROWS = [{ label: 'First name', value: 'crm_lead.first_name', group: 'Lead', description: 'crm_lead.first_name' }]

function mountWith(modelValue = []) {
  return mountTatva(FieldMap, {
    props: { modelValue, modes: MODES, modeControls: MODE_CONTROLS, fieldRows: FIELD_ROWS, valueRows: VALUE_ROWS },
  })
}

const lastEmit = (w) => w.emitted('update:modelValue').at(-1)[0]

// The mode switch is frappe-ui's `FormControl type="select"`, which in this version is a Reka combobox —
// a `<button role="combobox">` with a TELEPORTED listbox, not a native `<select>`, and it swallows a
// fallthrough attribute so it cannot be hooked by one either. Verified in isolation with the same props
// `ValueMap.vue` ships, so it is the widget's contract and not this control's. Driving it through its
// declared emit tests the handler under test rather than a third party's DOM.
function pickMode(w, i, mode) {
  const selects = w.findAllComponents(FormControl).filter((c) => c.props('type') === 'select')
  return selects[i].vm.$emit('update:modelValue', mode)
}

describe('FieldMap — the author names the rows, so rows are added and removed', () => {
  it('starts empty and says so rather than showing a phantom row', () => {
    const w = mountWith()
    expect(w.findAll('[data-test="field-map-row"]')).toHaveLength(0)
    expect(w.text()).toContain('No fields set yet')
  })

  it('adds a row in the FIRST declared mode', () => {
    const w = mountWith()
    const add = w.findAll('button').find((b) => b.text().includes('Set a field'))
    return add.trigger('click').then(() => {
      expect(lastEmit(w)).toEqual([{ name: '', mode: 'Literal', value: '' }])
    })
  })

  it('renders one row per declared field and keeps the others when one is removed', async () => {
    const w = mountWith([
      { name: 'status', mode: 'Literal', value: 'Open' },
      { name: 'custom_substage', mode: 'Literal', value: 'Contacted' },
    ])
    expect(w.findAll('[data-test="field-map-row"]')).toHaveLength(2)

    const remove = w.findAll('button').find((b) => b.html().includes('Remove'))
    await remove.trigger('click')
    expect(lastEmit(w)).toEqual([{ name: 'custom_substage', mode: 'Literal', value: 'Contacted' }])
  })

  it('draws each mode the input the DECLARATION names for it', () => {
    // Asserted against `mode_controls`, and also against the real DOM for the two that are unambiguous.
    for (const [mode, control] of Object.entries(MODE_CONTROLS)) {
      const w = mountWith([{ name: 'status', mode, value: '' }])
      expect(w.find(`[data-test="field-map-value-${control}"]`).exists()).toBe(true)
    }
    expect(mountWith([{ name: 'a', mode: 'Increment by', value: 1 }]).find('input[type="number"]').exists()).toBe(true)
    expect(mountWith([{ name: 'a', mode: 'Expression', value: 'x' }]).find('textarea').exists()).toBe(true)
  })

  it('is not fooled by mode ORDER — the control follows the map, not the position', () => {
    // The same row, with the declaration's list reversed. A component reading `modes[3]` for Increment
    // would draw the wrong input here and nothing would say so.
    const w = mountTatva(FieldMap, {
      props: {
        modelValue: [{ name: 'status', mode: 'Increment by', value: 1 }],
        modes: [...MODES].reverse(),
        modeControls: MODE_CONTROLS,
        fieldRows: FIELD_ROWS,
        valueRows: VALUE_ROWS,
      },
    })
    expect(w.find('[data-test="field-map-value-number"]').exists()).toBe(true)
  })

  it('clears the value when the mode changes', async () => {
    // A reference left behind would be WRITTEN as text onto a patient's field; a typed value left behind
    // would be READ as a reference to something nothing produces.
    const w = mountWith([{ name: 'status', mode: 'From Context', value: 'crm_lead.first_name' }])
    await pickMode(w, 0, 'Literal')
    expect(lastEmit(w)).toEqual([{ name: 'status', mode: 'Literal', value: '' }])
  })

  it('every row carries its OWN mode', () => {
    const w = mountWith([
      { name: 'status', mode: 'Literal', value: 'Open' },
      { name: 'custom_substage', mode: 'From Context', value: 'crm_lead.first_name' },
    ])
    const rows = w.findAll('[data-test="field-map-row"]')
    // Row one is a typed literal, row two a picker — the whole point of the mode being on the row.
    expect(rows[0].find('[data-test="field-map-value-data"]').exists()).toBe(true)
    expect(rows[1].find('[data-test="field-map-value-value-picker"]').exists()).toBe(true)
  })

  it('disables every control when the node is not editable', () => {
    const enabled = mountWith([{ name: 'status', mode: 'Literal', value: 'Open' }])
    const disabled = mountTatva(FieldMap, {
      props: {
        modelValue: [{ name: 'status', mode: 'Literal', value: 'Open' }],
        modes: MODES, modeControls: MODE_CONTROLS, fieldRows: FIELD_ROWS, valueRows: VALUE_ROWS,
        disabled: true,
      },
    })
    // The attribute lands ON the input: frappe-ui's text FormControl passes fallthrough attrs to it.
    expect(enabled.find('input[data-test="field-map-value-data"]').attributes('disabled')).toBeUndefined()
    expect(disabled.find('input[data-test="field-map-value-data"]').attributes('disabled')).toBeDefined()
    expect(disabled.findAll('button').find((b) => b.text().includes('Set a field')).attributes('disabled')).toBeDefined()
  })
})
