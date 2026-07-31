// A derived field is not a column: it cannot be written, and it can only be asked what its declaration can
// be composed into. Both guards read the SAME server descriptor — `is_derived`, stamped by
// `tatva_connect/list_engine/derived.py` — so a second derived field on any doctype is covered by the same
// three call sites (KanbanView's drag handle, ViewControls' set_value, Filter's operator menu) with no
// further edit. That, and not the `due_state` fieldname, is what these tests pin.
import { describe, expect, it } from 'vitest'

const { isDerivedField, narrowOperators, appliedFilters, DERIVED_OPERATORS } =
  await import('../../src/tatva/derivedField.js')

// The shape a `get_data` payload's `fields` and every lens menu carry: a real Select beside a derived one.
const FIELDS = [
  {
    fieldname: 'status',
    label: 'Status',
    fieldtype: 'Select',
    options: 'Backlog\nTodo\nDone',
  },
  {
    fieldname: 'due_state',
    label: 'Task Status',
    fieldtype: 'Select',
    options: 'Overdue\nDue Today\nUpcoming\nNo Due Date\nHistory',
    is_derived: 1,
  },
]

describe('a board is read-only iff its column field is derived', () => {
  it('a derived column field makes the board read-only', () => {
    expect(isDerivedField(FIELDS, 'due_state')).toBe(true)
  })

  it('a real column keeps drag-and-drop', () => {
    expect(isDerivedField(FIELDS, 'status')).toBe(false)
  })

  it('an unknown field, an unfetched list and a board with no column field are all writable', () => {
    expect(isDerivedField(FIELDS, 'nope')).toBe(false)
    expect(isDerivedField(undefined, 'due_state')).toBe(false)
    expect(isDerivedField(FIELDS, undefined)).toBe(false)
  })
})

// Exactly what Filter.vue builds for a Select today.
const SELECT_OPERATORS = [
  { label: 'Equals', value: 'equals' },
  { label: 'Not equals', value: 'not equals' },
  { label: 'In', value: 'in' },
  { label: 'Not in', value: 'not in' },
  { label: 'Is', value: 'is' },
]

describe('the operator menu never offers what the server must refuse', () => {
  // The engine composes all five from the declared buckets (`ListRequest._chosen`), so nothing is narrowed
  // away today — what this pins is that the menu can never offer MORE than the server serves.
  it('a derived field is offered only the operators the engine composes from its buckets', () => {
    expect(
      narrowOperators(SELECT_OPERATORS, FIELDS, 'due_state').map((o) => o.value),
    ).toEqual(['equals', 'not equals', 'in', 'not in', 'is'])
  })

  it('every operator it does offer is one the engine serves', () => {
    const offered = narrowOperators(SELECT_OPERATORS, FIELDS, 'due_state')
    for (const option of offered) {
      expect(DERIVED_OPERATORS).toContain(option.value)
    }
  })

  it('a real Select keeps its five, unchanged', () => {
    expect(narrowOperators(SELECT_OPERATORS, FIELDS, 'status')).toBe(
      SELECT_OPERATORS,
    )
  })
})

describe('the chip list survives a cold load', () => {
  it('reads the filters off the request when no response has landed', () => {
    const cold = { params: { filters: { due_state: 'Overdue' } } }
    expect(appliedFilters(cold)).toEqual({ due_state: 'Overdue' })
  })

  it('still prefers the request params when a response IS present', () => {
    const list = {
      params: { filters: { status: 'Todo' } },
      data: { params: { filters: { status: 'Done' } } },
    }
    expect(appliedFilters(list)).toEqual({ status: 'Todo' })
  })

  it('falls back to the response params, and answers nothing for a list with neither', () => {
    expect(
      appliedFilters({ data: { params: { filters: { status: 'Done' } } } }),
    ).toEqual({ status: 'Done' })
    expect(appliedFilters({})).toBeNull()
    expect(appliedFilters(undefined)).toBeNull()
  })
})
