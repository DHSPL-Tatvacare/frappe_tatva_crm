import { describe, it, expect } from 'vitest'
import { FormControl, Select, Autocomplete } from 'frappe-ui'
import { mountTatva } from './_mount'
import PredicateBuilder from '@/tatva/PredicateBuilder.vue'

// THE SUITE `RouteRows.test.js` NAMED AND NOBODY WROTE. It exists because the canvas shipped a predicate
// whose operator select was empty on every row: W2.3 renamed a variable's identity from `key` to `ref`,
// updated `valueRows`/`groupedOptions`, and missed this component — which went on indexing `f.key`. The
// field dropdown kept working (it reads through `valueRows`) so nothing looked broken, while everything
// downstream of the field lookup silently resolved to `undefined`.
//
// So these fixtures are the BACKEND'S OWN ANSWER, not a convenient shape: `upstream._shaped`
// (upstream.py:146) emits exactly `{ref, label, type, source, source_label}` — no `key`, no `operators`,
// and no `options`. A test that invented a `key` here would have stayed green through the entire outage.
//
// `options` is absent DELIBERATELY: `refs.readable_for` (refs.py:158) drops the `options` that
// `describe._descriptor` produces, so a Select field's value control cannot be a dropdown today. That is a
// backend gap raised in `docs/pending/`, and asserting a dropdown here would test a wire that does not exist.
const VARIABLES = [
  { ref: 'crm_lead.status', label: 'Status', type: 'Select', source: 'crm_lead', source_label: 'CRM Lead' },
  { ref: 'crm_lead.custom_patient_age', label: 'Patient Age', type: 'Int', source: 'crm_lead', source_label: 'CRM Lead' },
  { ref: 'n2.status', label: 'HTTP status code', type: 'Int', source: 'n2', source_label: 'n2 · Call API' },
]

// From `describe.builder_schema` via `node_context` — operators resolve by TYPE, never per field.
const OPERATORS_BY_TYPE = {
  Select: ['is', 'is not', 'is set', 'is not set'],
  Int: ['equals', 'greater than', 'less than'],
  Date: ['on', 'before', 'after'],
}
const OPERATOR_SHAPES = { none: ['is set', 'is not set'], range: [], list: ['in', 'not in'] }

function mountRule(node) {
  return mountTatva(PredicateBuilder, {
    props: {
      modelValue: node,
      fields: VARIABLES,
      operatorsByType: OPERATORS_BY_TYPE,
      operatorShapes: OPERATOR_SHAPES,
      subject: 'CRM Lead',
    },
  })
}

// The rule row renders, in order: the field Autocomplete, the operator FormControl, then the value
// FormControl. Read off the components rather than the DOM because frappe-ui's Select is reka-ui — its
// options live in a portal that only exists once a REAL mouse opens it, so a rendered-options assertion
// would fail for a reason that has nothing to do with this contract.
//
// The operator list is read off the inner `Select`, not off `FormControl`: `options` is not declared in
// `FormControlProps`, so it falls through `useAttrs` and `FormControl.props('options')` is always
// undefined. `type` IS declared there, so the value widget is read one level up.
const operatorOptions = (w) => w.findComponent(Select).props('options')
const valueControl = (w) => w.findAllComponents(FormControl)[1]

describe('PredicateBuilder — a variable is identified by its `ref`, and everything downstream depends on it', () => {
  it('offers the operators the picked field TYPE declares', () => {
    const w = mountRule({ type: 'rule', field: 'crm_lead.status', operator: 'is', value: '' })

    expect(operatorOptions(w)).toEqual([
      { label: 'is', value: 'is' },
      { label: 'is not', value: 'is not' },
      { label: 'is set', value: 'is set' },
      { label: 'is not set', value: 'is not set' },
    ])
  })

  it('resolves a value produced by an upstream NODE, not only a subject field', () => {
    const w = mountRule({ type: 'rule', field: 'n2.status', operator: 'equals', value: '' })

    expect(operatorOptions(w).map((o) => o.value)).toEqual([
      'equals', 'greater than', 'less than',
    ])
  })

  it('gives the value control the widget the field TYPE calls for', () => {
    const w = mountRule({ type: 'rule', field: 'crm_lead.custom_patient_age', operator: 'equals', value: '' })

    expect(valueControl(w).props('type')).toBe('number')
  })

  it('seeds a new condition with the first field, not a blank one', async () => {
    const w = mountRule(null)
    const add = w.findAll('button').find((b) => b.text().includes('Add condition'))
    await add.trigger('click')

    const seeded = w.emitted('update:modelValue').at(-1)[0]
    expect(seeded.field).toBe('crm_lead.status')
    expect(seeded.operator).toBe('is')
  })

  it('re-derives the operator when the author changes the field', async () => {
    const w = mountRule({ type: 'rule', field: 'crm_lead.status', operator: 'is', value: 'Open' })
    w.findComponent(Autocomplete).vm.$emit('update:modelValue', { value: 'crm_lead.custom_patient_age' })
    await w.vm.$nextTick()

    const patched = w.emitted('update:modelValue').at(-1)[0]
    expect(patched.field).toBe('crm_lead.custom_patient_age')
    expect(patched.operator).toBe('equals') // the Int vocabulary, not the 'is' fallback
  })

  it('hides the value control for an operator that takes no value', () => {
    const w = mountRule({ type: 'rule', field: 'crm_lead.status', operator: 'is set', value: null })

    expect(w.findAllComponents(FormControl)).toHaveLength(1) // the operator control, and nothing to fill in
  })
})
