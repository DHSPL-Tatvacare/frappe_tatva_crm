// The ONE control resolver, held to the field types that actually exist in this product.
//
// The list below is not invented: it is every fieldtype the live catalogs carry (lead 408 fields,
// activity 335, plus the raw Call Log / Task / Lead doctypes), read off the site. A type that reaches
// this resolver and falls off the end is a blank cell in a filter, so the point of this file is that
// nothing falls off the end — for any type, at any operator.
import { describe, it, expect } from 'vitest'
import {
  resolveControl,
  arityOf,
  valuesOf,
  defaultOperator,
  valueFromFilter,
} from '@/tatva/fieldControl'

// Every fieldtype seen in the live inventory.
const TYPES = [
  'Data', 'Small Text', 'Text', 'Long Text', 'Text Editor', 'Code',
  'Int', 'Float', 'Currency', 'Percent',
  'Date', 'Datetime',
  'Link', 'Dynamic Link',
  'Select', 'Autocomplete',
  'Check', 'Duration', 'Rating',
  'Attach', 'Attach Image', 'Geolocation', 'Table', 'Table MultiSelect',
]

// Every operator any of the three surfaces can offer.
const OPERATORS = [
  '=', '!=', '>', '<', '>=', '<=', 'like', 'not like', 'in', 'not in',
  'is set', 'is not set', 'between', 'timespan', 'is', 'equals', 'not equals',
]

describe('resolveControl', () => {
  it('answers for every field type at every operator, and never throws', () => {
    for (const fieldtype of TYPES) {
      for (const operator of OPERATORS) {
        const out = resolveControl({ fieldtype, label: 'X', options: '' }, operator)
        expect(out, `${fieldtype} / ${operator}`).toBeTruthy()
        expect(out).toHaveProperty('arity')
        // `none` is the one case with no control; everything else must render something.
        if (out.arity !== 'none') expect(out.is, `${fieldtype} / ${operator}`).toBeTruthy()
      }
    }
  })

  it('gives no control to an operator that takes no value', () => {
    for (const operator of ['is set', 'is not set']) {
      expect(resolveControl({ fieldtype: 'Data' }, operator).is).toBe(null)
    }
  })

  // Source (searched) and Sub-stage (listed) offered different numbers of values from the same bar. The
  // rule is one: where the values COME FROM is not how many you may PICK.
  it('lets a searched field hold as many values as a listed one', () => {
    const searched = resolveControl({ fieldtype: 'Link', options: 'CRM Lead Source' }, 'in')
    const listed = resolveControl({ fieldtype: 'Select', options: 'A\nB' }, 'in')
    expect(searched.arity).toBe('many')
    expect(searched.props.multiple).toBe(true)
    expect(listed.arity).toBe('many')
    expect(listed.props.multiple).toBe(true)
    expect(resolveControl({ fieldtype: 'Link', options: 'CRM Lead Source' }, '=').props.multiple)
      .toBe(false)
  })

  it('reads arity off the operator, never off the field', () => {
    expect(arityOf('in')).toBe('many')
    expect(arityOf('not in')).toBe('many')
    expect(arityOf('between')).toBe('range')
    expect(arityOf('is set')).toBe('none')
    expect(arityOf('=')).toBe('one')
    // Same field, three operators, three arities — the axis the old chains did not have.
    const field = { fieldtype: 'Select', options: 'A\nB' }
    expect(resolveControl(field, '=').arity).toBe('one')
    expect(resolveControl(field, 'in').arity).toBe('many')
    expect(resolveControl(field, 'is set').arity).toBe('none')
  })

  it('is multi only when the operator asks for it', () => {
    const field = { fieldtype: 'Select', options: 'A\nB' }
    expect(resolveControl(field, '=').props.multiple).toBe(false)
    expect(resolveControl(field, 'in').props.multiple).toBe(true)
  })
})

describe('valuesOf — the three shapes an option list arrives in', () => {
  it('reads a newline string', () => {
    const out = valuesOf({ fieldtype: 'Select', options: 'Cold\nWarm\nHot' })
    expect(out.kind).toBe('inline')
    expect(out.options.map((o) => o.value)).toEqual(['Cold', 'Warm', 'Hot'])
  })

  it('reads a list of plain values', () => {
    const out = valuesOf({ fieldtype: 'Link', grain_options: ['Goodflip', 'Tatvapractice'] })
    expect(out.kind).toBe('inline')
    expect(out.options.map((o) => o.value)).toEqual(['Goodflip', 'Tatvapractice'])
  })

  it('reads a list the server already shaped, rather than stringifying it', () => {
    // THE regression: `String(options).split('\n')` turned this into ONE option labelled
    // "[object Object],[object Object]".
    const out = valuesOf({
      fieldtype: 'Select',
      options: [{ label: 'Overdue', value: 'overdue' }, { label: 'Due Today', value: 'due_today' }],
    })
    expect(out.kind).toBe('inline')
    expect(out.options).toHaveLength(2)
    expect(out.options[0].label).toBe('Overdue')
  })

  it('a grain axis is an inline list, not a special case', () => {
    expect(valuesOf({ fieldtype: 'Link', options: 'CRM Lead Stage', grain_options: ['New'] }).kind)
      .toBe('inline')
  })

  it('a select declared with no options degrades to free input, not an empty menu', () => {
    expect(valuesOf({ fieldtype: 'Select', options: '' }).kind).toBe('free')
  })

  it('a link with a target is searched, not listed', () => {
    const out = valuesOf({ fieldtype: 'Link', options: 'CRM Lead Status' })
    expect(out.kind).toBe('search')
    expect(out.doctype).toBe('CRM Lead Status')
  })

  it('a dynamic link has no fixed target, so it offers nothing to search', () => {
    expect(valuesOf({ fieldtype: 'Dynamic Link', options: 'reference_doctype' }).kind).toBe('free')
  })
})

// A bar with no operator picker still HAS an operator, and which one is a property of the FIELD. It used
// to be decided in the bar, off a second list of date types kept there — the duplication this file exists
// to prevent. Asked here, beside every other field-type question.
describe('defaultOperator — which operator a field wants when nobody picks one', () => {
  it('asks a moment in time for a NAMED RANGE, never an exact instant', () => {
    expect(defaultOperator({ fieldtype: 'Date' })).toBe('timespan')
    expect(defaultOperator({ fieldtype: 'Datetime' })).toBe('timespan')
  })

  it('asks a field that OFFERS values for several of them', () => {
    expect(defaultOperator({ fieldtype: 'Select', options: 'Open\nClosed' })).toBe('in')
    expect(defaultOperator({ fieldtype: 'Link', options: 'User' })).toBe('in')
    expect(defaultOperator({ fieldtype: 'Link', grain_options: ['A', 'B'] })).toBe('in')
  })

  it('asks everything else for equals', () => {
    expect(defaultOperator({ fieldtype: 'Data' })).toBe('=')
    expect(defaultOperator({ fieldtype: 'Int' })).toBe('=')
    expect(defaultOperator({ fieldtype: 'Check' })).toBe('in')
  })

  it('and the control follows from it, with no second decision', () => {
    const when = { fieldtype: 'Datetime', label: 'Created On' }
    const control = resolveControl(when, defaultOperator(when))
    expect(control.props.options.map((o) => o.value)).toContain('today')
  })
})

// Reading a filter back is the other half of writing one, and the half that was maintained apart: the bar
// learned to store a named date range and never learned to read one, so every date filter applied to the
// list while its own control sat blank. These lock the round trip — what the bar writes, the bar reads.
describe('valueFromFilter — what the control holds for a filter already applied', () => {
  const WHEN = { fieldname: 'creation', fieldtype: 'Datetime', label: 'Created On' }
  const LISTED = { fieldname: 'status', fieldtype: 'Select', options: 'Open\nClosed', label: 'Status' }
  const TYPED = { fieldname: 'title', fieldtype: 'Data', label: 'Title' }
  const PEOPLE = { fieldname: '_assign', fieldtype: 'Link', options: 'User', match: 'contains' }

  it('reads a NAMED DATE RANGE back as itself — the defect this replaced', () => {
    expect(valueFromFilter(WHEN, ['timespan', 'today'])).toBe('today')
    expect(valueFromFilter(WHEN, ['timespan', 'last week'])).toBe('last week')
  })

  it('round-trips every operator the bar itself writes', () => {
    for (const field of [WHEN, LISTED, TYPED]) {
      const op = defaultOperator(field)
      const written = op === 'in' ? ['Open'] : 'today'
      expect(valueFromFilter(field, [op, written])).toEqual(written)
    }
  })

  it('reads "is one of" back as the list the picker shows', () => {
    expect(valueFromFilter(LISTED, ['in', ['Open', 'Closed']])).toEqual(['Open', 'Closed'])
    expect(valueFromFilter(LISTED, ['in', 'Open'])).toEqual(['Open'])
  })

  it('reads a people column back as the name inside the wildcards', () => {
    expect(valueFromFilter(PEOPLE, ['LIKE', '%jane@x.com%'])).toBe('jane@x.com')
  })

  it('reads a typed search back as the text, without its wildcards', () => {
    expect(valueFromFilter(TYPED, ['LIKE', '%acme%'])).toBe('acme')
  })

  it('says NOTHING for a filter its control cannot edit, rather than half-showing one', () => {
    // A two-ended range on a control that picks one named range; a wildcard search on a dropdown.
    expect(valueFromFilter(WHEN, ['between', ['2026-01-01', '2026-02-01']])).toBe('')
    expect(valueFromFilter(LISTED, ['LIKE', '%Open%'])).toEqual([])
  })

  it('is empty in the shape its own control is empty in', () => {
    expect(valueFromFilter(LISTED, undefined)).toEqual([])
    expect(valueFromFilter(TYPED, undefined)).toBe('')
    expect(valueFromFilter(WHEN, null)).toBe('')
  })

  it('reads a bare stored value back unchanged', () => {
    expect(valueFromFilter({ fieldtype: 'Select', label: 'x' }, 'Draft')).toBe('Draft')
  })
})
