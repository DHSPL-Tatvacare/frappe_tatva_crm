import { describe, it, expect } from 'vitest'
import { valueFromFilter } from '@/tatva/fieldControl'
// Shapes taken verbatim from prod `CRM View Settings.filters`.
const WHEN = { fieldname: 'custom_followup_at', fieldtype: 'Datetime' }
const TEXT = { fieldname: 'title', fieldtype: 'Data' }
const LISTED = { fieldname: 'status', fieldtype: 'Select', options: 'Backlog\nTodo\nIn Progress' }
const PEOPLE = { fieldname: '_assign', fieldtype: 'Link', options: 'User', match: 'contains' }
describe('prod-shaped saved filters do not break the bar', () => {
  it('a malformed between (null bounds) reads back empty, never throws', () => {
    expect(() => valueFromFilter(WHEN, ['between', null])).not.toThrow()
    expect(valueFromFilter(WHEN, ['between', null])).toBe('')
  })
  it('a real between reads back empty on a one-pick date control', () => {
    expect(valueFromFilter(WHEN, ['between', ['2026-08-04', '2026-09-03']])).toBe('')
  })
  it('timespan — the shape prod already stores — round-trips', () => {
    expect(valueFromFilter(WHEN, ['timespan', 'today'])).toBe('today')
    expect(valueFromFilter(WHEN, ['timespan', 'last week'])).toBe('last week')
  })
  it('an empty LIKE reads back as empty text', () => {
    expect(valueFromFilter(TEXT, ['LIKE', '%%'])).toBe('')
  })
  it('an in-list reads back as the list', () => {
    expect(valueFromFilter(LISTED, ['in', ['Backlog', 'Todo', 'In Progress']])).toEqual(['Backlog','Todo','In Progress'])
  })
  it('a people LIKE reads back the name inside the wildcards', () => {
    expect(valueFromFilter(PEOPLE, ['LIKE', '%shreenika%'])).toBe('shreenika')
  })
  it('a bare composite value reads back unchanged', () => {
    expect(valueFromFilter(LISTED, 'Inside-Sales::RNR 1')).toBe('Inside-Sales::RNR 1')
  })
  it('a >= filter the bar cannot express reads back empty, never throws', () => {
    expect(() => valueFromFilter(WHEN, ['>=', '2026-08-25 00:00:00'])).not.toThrow()
  })
})
