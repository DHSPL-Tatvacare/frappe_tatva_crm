import { describe, it, expect } from 'vitest'
import { valueRows, fieldRows, groupedOptions, labelOf, variableFor, controlFor } from '@/tatva/valueOptions'

// The grouper every picker on the canvas funnels through. Fixtures are the BACKEND'S shapes verbatim,
// because the two sides deliberately use different words and a test that smoothed that over would hide
// the exact defect this file exists for:
//   `node_context.variables` — `upstream._shaped` → {ref, label, type, source, source_label}
//   `node_context.settable`  — `describe.builder_schema` → {key, label, doctype}
// `ref` is a NAMESPACED reference (what a node reads); `key` is describe's BARE field name (what a node
// writes). Two concepts, two words, on purpose — see refs.py:145.
const VARIABLES = [
  { ref: 'crm_lead.status', label: 'Status', type: 'Select', source: 'crm_lead', source_label: 'CRM Lead' },
  { ref: 'crm_lead.first_name', label: 'First Name', type: 'Data', source: 'crm_lead', source_label: 'CRM Lead' },
  { ref: 'call-api-1.status', label: 'HTTP status code', type: 'Int', source: 'call-api-1', source_label: 'call-api-1 · Call API' },
]

// `pick` is describe._pick_for's answer, riding both seams via `_descriptor`; dropping it made Links text boxes.
const SETTABLE = [
  { key: 'status', label: 'Status', doctype: 'CRM Lead', type: 'Select',
    pick: { kind: 'select', options: ['New', 'Open'] } },
  { key: 'custom_patient_age', label: 'Patient Age', doctype: 'CRM Lead', type: 'Int' },
  { key: 'custom_substage', label: 'Stage', doctype: 'CRM Lead', type: 'Link',
    pick: { kind: 'link', target: 'CRM Lead Stage' } },
]

describe('valueRows — a variable is offered under the source that produced it', () => {
  it('carries the ref as the VALUE, so what the picker emits is what the engine resolves', () => {
    expect(valueRows(VARIABLES)[0]).toEqual({
      label: 'Status',
      value: 'crm_lead.status',
      group: 'CRM Lead',
      description: 'crm_lead.status',
      pick: null,
      type: 'Select',
    })
  })

  it('keeps two same-named values apart by their source', () => {
    const rows = valueRows(VARIABLES)
    const statuses = rows.filter((r) => r.label === 'Status' || r.label === 'HTTP status code')

    // Both are a "status"; the author can only tell them apart by group and ref, so both must differ.
    expect(statuses.map((r) => r.value)).toEqual(['crm_lead.status', 'call-api-1.status'])
    expect(statuses.map((r) => r.group)).toEqual(['CRM Lead', 'call-api-1 · Call API'])
  })

  it('falls back to the ref when the backend sent no label', () => {
    expect(valueRows([{ ref: 'n1.thing', source: 'n1' }])[0].label).toBe('n1.thing')
  })
})

describe('fieldRows — a WRITE target keeps describe’s bare `key`, grouped by record', () => {
  it('does not read `ref`, which settable rows do not carry', () => {
    expect(fieldRows(SETTABLE).map((r) => r.value)).toEqual([
      'status', 'custom_patient_age', 'custom_substage',
    ])
    expect(fieldRows(SETTABLE)[0]).toEqual({
      label: 'Status', value: 'status', group: 'CRM Lead', description: 'status',
      type: 'Select', pick: { kind: 'select', options: ['New', 'Open'] },
    })
  })
})

// THE fix for the `::` defect: the FIELD decides the editor, and every consumer asks this one function.
describe('controlFor — the editor a literal gets is the field’s own answer', () => {
  it('draws a Link as a link picker, naming the doctype so titles resolve', () => {
    const row = fieldRows(SETTABLE).find((r) => r.value === 'custom_substage')
    expect(controlFor(row)).toEqual({ control: 'link', doctype: 'CRM Lead Stage' })
  })

  it('draws a Select as a dropdown of its real choices', () => {
    const row = fieldRows(SETTABLE).find((r) => r.value === 'status')
    expect(controlFor(row)).toEqual({
      control: 'select',
      options: [{ label: 'New', value: 'New' }, { label: 'Open', value: 'Open' }],
    })
  })

  it('falls back to the TYPE only when the field declares no pick source', () => {
    const row = fieldRows(SETTABLE).find((r) => r.value === 'custom_patient_age')
    expect(controlFor(row)).toEqual({ control: 'number' })
  })

  it('is a plain box for a field that is genuinely free text, and for nothing', () => {
    expect(controlFor({ type: 'Data' })).toEqual({ control: 'data' })
    expect(controlFor(null)).toEqual({ control: 'data' })
  })
})

describe('groupedOptions — the server’s order, and never a silently blanked reference', () => {
  it('makes one group per source, in the order the server sent them', () => {
    const groups = groupedOptions(valueRows(VARIABLES), null)

    expect(groups.map((g) => g.group)).toEqual(['CRM Lead', 'call-api-1 · Call API'])
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].items).toHaveLength(1)
  })

  it('hides the heading for rows that carry no source', () => {
    const groups = groupedOptions([{ label: 'Status', value: 'status', group: '' }], null)

    expect(groups[0].hideLabel).toBe(true)
  })

  it('prepends a saved reference nothing produces any more, rather than dropping it', () => {
    const groups = groupedOptions(valueRows(VARIABLES), 'deleted-node-3.result')

    expect(groups[0].items[0].value).toBe('deleted-node-3.result')
    expect(groups[0].items[0].label).toBe('deleted-node-3.result')
    // and the live offer is still whole underneath it
    expect(groups.slice(1).map((g) => g.group)).toEqual(['CRM Lead', 'call-api-1 · Call API'])
  })

  it('does NOT prepend a value that is still on offer', () => {
    const groups = groupedOptions(valueRows(VARIABLES), 'crm_lead.status')

    expect(groups).toHaveLength(2)
    expect(groups[0].group).toBe('CRM Lead')
  })
})

describe('variableFor — the reverse of valueRows, and the reason the operator select went blank', () => {
  it('finds the variable a picked value came from', () => {
    expect(variableFor(VARIABLES, 'call-api-1.status').type).toBe('Int')
  })

  it('answers null for a reference nothing produces, instead of a stale neighbour', () => {
    expect(variableFor(VARIABLES, 'deleted-node-3.result')).toBeNull()
  })

  it('answers null for describe’s BARE key — the word this lookup must NOT accept', () => {
    // `status` is a real settable key and a real field name. If this ever resolved, the two vocabularies
    // would have merged again and `crm_lead.status` vs `call-api-1.status` would collapse to one answer.
    expect(variableFor(VARIABLES, 'status')).toBeNull()
  })

  it('survives an empty wire without throwing on the render path', () => {
    expect(variableFor(undefined, 'crm_lead.status')).toBeNull()
    expect(variableFor(VARIABLES, undefined)).toBeNull()
  })
})

describe('labelOf', () => {
  it('reads a dead reference as itself, so the author sees WHAT is dangling', () => {
    expect(labelOf(valueRows(VARIABLES), 'deleted-node-3.result')).toBe('deleted-node-3.result')
    expect(labelOf(valueRows(VARIABLES), 'crm_lead.first_name')).toBe('First Name')
  })
})
