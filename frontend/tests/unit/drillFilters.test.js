// Purpose: a card and the list it opens must show the SAME rows, so the filter that produced the figure
// travels in the URL — the one piece of untrusted input the list layer reads. This judges its shape. The
// drill is then applied through the app's own updateFilter and the query is stripped, so there is no second
// kind of filter to reason about and nothing here decides whether it persists.
import { describe, expect, it } from 'vitest'
import { parseDrillFilters } from '../../src/tatva/drillFilters.js'

describe('parseDrillFilters', () => {
  it('a valid object payload comes back as filters to merge', () => {
    const raw = JSON.stringify({
      creation: ['between', ['2026-07-01', '2026-07-31']],
      source: 'Cold Call',
    })
    expect(parseDrillFilters(raw)).toEqual({
      creation: ['between', ['2026-07-01', '2026-07-31']],
      source: 'Cold Call',
    })
  })

  it("the backend's own blank-group grammar survives untouched", () => {
    expect(parseDrillFilters('{"source":["is","not set"]}')).toEqual({
      source: ['is', 'not set'],
    })
  })

  it('malformed JSON is ignored entirely, with nothing said to the user', () => {
    expect(parseDrillFilters('{not json')).toBe(null)
    expect(parseDrillFilters('')).toBe(null)
    expect(parseDrillFilters(undefined)).toBe(null)
  })

  it('an array or a primitive is not a filter payload', () => {
    expect(parseDrillFilters('[1,2,3]')).toBe(null)
    expect(parseDrillFilters('"source"')).toBe(null)
    expect(parseDrillFilters('42')).toBe(null)
    expect(parseDrillFilters('null')).toBe(null)
  })

  it('an empty object is nothing to apply', () => {
    expect(parseDrillFilters('{}')).toBe(null)
  })

  // The backend never emits a dotted key — `_drill` filters on the grouped COLUMN, never on the label
  // field it reached through — so a dot means the payload was hand-edited.
  it('a dotted key rejects the WHOLE payload, never just that key', () => {
    expect(parseDrillFilters('{"lead_owner.full_name":"Asha Menon"}')).toBe(null)
    expect(
      parseDrillFilters('{"source":"Cold Call","lead_owner.full_name":"Asha"}'),
    ).toBe(null)
  })

  it('an empty key rejects the payload too', () => {
    expect(parseDrillFilters('{"":"Cold Call"}')).toBe(null)
  })
})

