// Purpose: a dashboard card and the list it opens must show the SAME rows, so the filter that produced
// the figure travels in the URL — which makes `?filters=` the one piece of untrusted input the list layer
// reads. This is the judgement of its shape, and the rule that a drill must never be written into the
// user's saved standard view (which `updateFilter` did unconditionally, corrupting their default list).
import { describe, expect, it } from 'vitest'
import {
  DRILL_PAGE_LENGTH,
  parseDrillFilters,
  shouldPersistFilterChange,
} from '../../src/tatva/drillFilters.js'

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

  it('a drill starts at the default page size, not whatever the list had grown to', () => {
    expect(DRILL_PAGE_LENGTH).toBe(20)
  })
})

describe('shouldPersistFilterChange', () => {
  it('an ordinary filter change on a standard view still persists — the default is unchanged', () => {
    expect(shouldPersistFilterChange(true, {})).toBe(true)
    expect(shouldPersistFilterChange(undefined, {})).toBe(true)
  })

  it('a named saved view is never overwritten, as before', () => {
    expect(shouldPersistFilterChange(true, { view: 'my-view' })).toBe(false)
  })

  it('persist: false never writes the view', () => {
    expect(shouldPersistFilterChange(false, {})).toBe(false)
  })

  // THE bug this exists for: land on Leads from a dashboard slice, narrow it once, and the drill filter
  // becomes the user's default Leads list forever.
  it('a drill arrival never writes the drill filter into the saved standard view', () => {
    const query = { filters: '{"source":"Cold Call"}' }
    expect(shouldPersistFilterChange(true, query)).toBe(false)
  })

  it('a junk ?filters= is not a drill arrival, so the ordinary rule still applies', () => {
    expect(shouldPersistFilterChange(true, { filters: '{not json' })).toBe(true)
  })
})
