// Purpose: lock the membership encoding against the engine's own splitter. Every case here is mirrored in
// `tests/automation/test_membership_roundtrip.py`, so the two languages are PROVEN to agree rather than
// assumed to — and the production strings are included verbatim, because those are what must not change.
import { describe, it, expect } from 'vitest'
import { splitItems, joinItems, unexpressable } from '@/tatva/predicateList'

// Read verbatim from CRM Workflow Node on 2026-09-12. Config, not patient data.
const LIVE = {
  source_in: 'Landing Page MR Form,Mobile App,Tucatinib,Ujvira,Nivolumab',
  source_not_in: 'Inbound Phone call,Goodflip',
  outcome_in: 'Connected - Call back later,Not Connected',
  substage_not_in:
    'Sigrima::Patient no more\nUjvira::Patient no more\nNivolumab::Patient no more',
  connected_in:
    'Chemo Completed - Marked attendance on Portal and asked patient to upload discharge summary,Chemo Completed- Marked attendance on Portal and Documents Uploaded',
}

describe('membership encoding', () => {
  it('reads a comma list, a newline list, and a mix of both', () => {
    expect(splitItems('a,b')).toEqual(['a', 'b'])
    expect(splitItems('a\nb')).toEqual(['a', 'b'])
    expect(splitItems('a,b\nc')).toEqual(['a', 'b', 'c'])
  })

  it('trims and drops blanks, so a trailing separator is not an empty condition', () => {
    expect(splitItems(' a , b ,, \n ')).toEqual(['a', 'b'])
    expect(splitItems('')).toEqual([])
    expect(splitItems(null)).toEqual([])
    expect(splitItems(undefined)).toEqual([])
  })

  it('accepts a list as well as a string, so the control can hand back either', () => {
    expect(splitItems(['a', ' b '])).toEqual(['a', 'b'])
  })

  it('writes with a newline and stores each chosen value whole', () => {
    expect(joinItems(['a', 'b'])).toBe('a\nb')
    expect(splitItems(joinItems(['a', 'b']))).toEqual(['a', 'b'])
  })

  // The limit is the ENGINE's, not this file's: it splits on comma, so such a value fragments whatever
  // separator is written. Stated and surfaced, never silently saved.
  it('names a value the engine cannot read back, instead of hiding it', () => {
    const comma = 'Goodflip::India::Inside-Sales::Device, Lab Tests,  Tickets related and  other calls'
    expect(unexpressable([comma, 'Other'])).toEqual([comma])
    expect(unexpressable(['Connected', 'Not Connected'])).toEqual([])
    // and this is WHY it is refused — the engine would see four values, not two
    expect(splitItems(joinItems([comma, 'Other']))).not.toEqual([comma, 'Other'])
  })

  it('EVERY live production condition round-trips to the same items', () => {
    for (const [name, stored] of Object.entries(LIVE)) {
      expect(splitItems(joinItems(splitItems(stored))), name).toEqual(splitItems(stored))
    }
  })

  it('a single value is still a single value', () => {
    expect(splitItems('Connected')).toEqual(['Connected'])
    expect(joinItems(['Connected'])).toBe('Connected')
  })
})
