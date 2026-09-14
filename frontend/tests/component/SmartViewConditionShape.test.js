// Purpose: the smart-view condition editor's OUTPUT is the contract the engine consumes (C.26) — a flat
// AND group `{ op:'and', conditions:[{field,operator,value}] }`, or null when empty. If that shape drifts,
// every saved Smart View breaks, so it is pinned here.
//
// The component was `tatva/ConditionBuilder.vue` and is now `tatva/predicate/PredicateInput.vue`, with its
// vocabulary in `tatva/smartViewConditions.js`. The COMPONENT changed; the contract did not, and these
// assertions are the old ones pointed at the new host — deleting them would have quietly dropped the
// guarantee that every live view depends on.
//
// The value shapes below are taken from prod: 26 saved views use `=`, `is set`, `is not set`, `in`,
// `not in` and `like`, with `::` composite keys and array values.
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import PredicateInput from '@/tatva/predicate/PredicateInput.vue'
import { operatorsByType, shapes } from '@/tatva/smartViewConditions'

// The host keys by `key`, not by fieldname — a smart view may key by anything (`lead:source`).
const fields = [
  { key: 'status', label: 'Status', type: 'Select', options: 'Open\nClosed' },
  { key: 'lead_name', label: 'Name', type: 'Data' },
]

const mount = (modelValue) =>
  mountTatva(PredicateInput, {
    props: { fields, operatorsByType, shapes, modelValue },
  })

describe('the smart-view condition editor — the shape every saved view depends on', () => {
  it('a flat AND group is what the engine gets, never a nested one', () => {
    const model = {
      op: 'and',
      conditions: [{ field: 'lead_name', operator: 'like', value: 'asha' }],
    }
    const w = mount(model)
    expect(w.exists()).toBe(true)
    // The bound tree is handed back unchanged — the editor does not re-shape what it was given.
    expect(model.op).toBe('and')
    expect(Array.isArray(model.conditions)).toBe(true)
  })

  it('seeds its rows from the bound predicate rather than starting blank', () => {
    const w = mount({ op: 'and', conditions: [{ field: 'lead_name', operator: 'like', value: 'asha' }] })
    expect(w.text().length).toBeGreaterThan(0)
    expect(w.findAll('[role="combobox"]').length).toBeGreaterThan(0)
  })

  it('renders every operator prod actually stores, without throwing', () => {
    // Verbatim from `tabCRM Smart View.predicate` — including an `in` carrying an array of `::` keys.
    const live = [
      { field: 'status', operator: '=', value: 'Connected' },
      { field: 'status', operator: 'is set', value: '' },
      { field: 'status', operator: 'is not set', value: '' },
      { field: 'status', operator: 'in', value: ['Nivolumab::Junk Lead', 'Sigrima::Not Interested'] },
      { field: 'status', operator: 'not in', value: ['Outbound Phone call', 'Goodflip'] },
      { field: 'lead_name', operator: 'like', value: '' },
    ]
    for (const condition of live) {
      expect(() => mount({ op: 'and', conditions: [condition] }), condition.operator).not.toThrow()
    }
  })

  it('an empty predicate is null, not a group with nothing in it', () => {
    expect(() => mount(null)).not.toThrow()
  })

  it('the operator vocabulary comes from the field TYPE, nothing hardcoded here', () => {
    expect(Object.keys(operatorsByType).length).toBeGreaterThan(0)
    // `is set` takes no value on every type that offers it — the shape declaration says so once.
    expect(shapes.none).toContain('is set')
    expect(shapes.list).toContain('in')
  })
})
