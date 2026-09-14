// Purpose: ConditionBuilder is the generic predicate editor whose OUTPUT is the contract the smart-view
// engine consumes (C.26) — a flat AND group { op:'and', conditions:[{field,operator,value}] }, or null
// when empty. The default operator is derived from the field's type, nothing hardcoded. If this shape
// drifts, every saved Smart View breaks, so it is pinned here.
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import ConditionBuilder from '@/tatva/ConditionBuilder.vue'

const fields = [
  { fieldname: 'status', label: 'Status', fieldtype: 'Select', options: 'Open\nClosed' },
  { fieldname: 'lead_name', label: 'Name', fieldtype: 'Data' },
]

// A Select the operator declared but never gave options to. Three such fields exist in the live lead
// catalog today (Platform (Mobile App), Prescription (Rx) Status, Location strata of doctor) plus one on
// two activity types. Options are operator data and this component does not invent them — but a dropdown
// with an empty menu is a DEAD END, so the value must degrade to something the user can actually fill.
const optionlessSelect = [
  { fieldname: 'platform', label: 'Platform', fieldtype: 'Select', options: '' },
]

// WHAT THE VALUE CONTROL ACTUALLY IS. frappe-ui's Select is a reka-ui headless control — a
// role="combobox" TRIGGER, never a native <select>, with its options teleported away — so the kind of
// control is read from the row's shape, not from a tag name. Every row carries a BASELINE of two
// comboboxes (the field Autocomplete and the operator) and one input (the Autocomplete's search box);
// a value PICKER adds a third combobox, a value TEXT BOX adds a second input, and `is set` adds neither.
const BASE_PICKERS = 2
const BASE_INPUTS = 1

function valueControl(wrapper) {
  const pickers = wrapper.findAll('[role="combobox"]').length
  const inputs = wrapper.findAll('input').length
  if (pickers > BASE_PICKERS) return 'picker'
  if (inputs > BASE_INPUTS) return 'text'
  return 'none'
}

describe('ConditionBuilder', () => {
  it('emits the flat AND predicate shape when a condition is added', async () => {
    const wrapper = mountTatva(ConditionBuilder, { props: { fields, modelValue: null } })
    const addBtn = wrapper.findAll('button').find((b) => b.text().includes('Add condition'))
    await addBtn.trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted.at(-1)[0]).toEqual({
      op: 'and',
      conditions: [{ field: 'status', operator: '=', value: '' }], // '=' is the Select default
    })
  })

  it('seeds its rows from the bound predicate', () => {
    const model = { op: 'and', conditions: [{ field: 'lead_name', operator: 'like', value: 'asha' }] }
    const wrapper = mountTatva(ConditionBuilder, { props: { fields, modelValue: model } })
    expect(wrapper.text()).toContain('Where') // first row label proves a seeded row rendered
  })

  // ---- pick, don't type ---------------------------------------------------------------------------

  it('offers a Select as a dropdown of its own declared options', () => {
    const model = { op: 'and', conditions: [{ field: 'status', operator: '=', value: '' }] }
    const wrapper = mountTatva(ConditionBuilder, { props: { fields, modelValue: model } })
    expect(valueControl(wrapper)).toBe('picker') // the value is chosen, never typed
  })

  it('degrades an option-less Select to a text box instead of an empty dropdown', () => {
    const model = { op: 'and', conditions: [{ field: 'platform', operator: '=', value: '' }] }
    const wrapper = mountTatva(ConditionBuilder, {
      props: { fields: optionlessSelect, modelValue: model },
    })
    // A picker here would be the dead end: a menu with nothing in it, and no way to state the condition.
    expect(valueControl(wrapper)).toBe('text')
  })

  it('leaves a free value as a text box — typing is correct where there is no set to pick from', () => {
    const model = { op: 'and', conditions: [{ field: 'lead_name', operator: 'like', value: '' }] }
    const wrapper = mountTatva(ConditionBuilder, { props: { fields, modelValue: model } })
    expect(valueControl(wrapper)).toBe('text')
  })

  it('drops the value control entirely for is set / is not set', () => {
    const model = { op: 'and', conditions: [{ field: 'status', operator: 'is set', value: '' }] }
    const wrapper = mountTatva(ConditionBuilder, { props: { fields, modelValue: model } })
    expect(valueControl(wrapper)).toBe('none') // there is nothing to supply
  })
})
