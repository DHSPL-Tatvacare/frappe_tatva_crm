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
})
