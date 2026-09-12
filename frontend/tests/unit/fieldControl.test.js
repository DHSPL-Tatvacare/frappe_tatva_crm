// The ONE control resolver, held to the field types that actually exist in this product.
//
// The list below is not invented: it is every fieldtype the live catalogs carry (lead 408 fields,
// activity 335, plus the raw Call Log / Task / Lead doctypes), read off the site. A type that reaches
// this resolver and falls off the end is a blank cell in a filter, so the point of this file is that
// nothing falls off the end — for any type, at any operator.
import { describe, it, expect } from 'vitest'
import { resolveControl, arityOf, valuesOf } from '@/tatva/fieldControl'

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
