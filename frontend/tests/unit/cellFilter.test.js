// Purpose: clicking a cell used to FILTER the list, which meant a rep clicking a Status cell to open the
// record got a filter instead. The row is already a link (or opens a modal), so a plain click belongs to
// the row and filtering has to be asked for — Alt-click. Cmd/Ctrl/Shift are the browser's own new-tab and
// new-window gestures on an anchor; intercepting any of them takes away the reason the row is a link.
import { describe, expect, it } from 'vitest'
import { shouldFilterOnCellClick } from '../../src/tatva/cellFilter.js'

const click = (mods = {}) => ({
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
})

describe('shouldFilterOnCellClick', () => {
  it('a plain click does not filter — it falls through to the row', () => {
    expect(shouldFilterOnCellClick(click())).toBe(false)
  })

  it('an Alt-click filters', () => {
    expect(shouldFilterOnCellClick(click({ altKey: true }))).toBe(true)
  })

  it('Cmd, Ctrl and Shift pass through untouched, alone or with Alt', () => {
    for (const mod of ['metaKey', 'ctrlKey', 'shiftKey']) {
      expect(shouldFilterOnCellClick(click({ [mod]: true }))).toBe(false)
      expect(
        shouldFilterOnCellClick(click({ altKey: true, [mod]: true })),
      ).toBe(false)
    }
  })

  it('a missing event never filters', () => {
    expect(shouldFilterOnCellClick(undefined)).toBe(false)
  })

  // Moving filtering to Alt-click was never meant to widen WHAT may be filtered. A Datetime value is an
  // exact instant, so a filter on it can only return the one row that was clicked.
  it('a Datetime or Time cell does not filter, even on Alt-click', () => {
    for (const type of ['Datetime', 'Time']) {
      expect(shouldFilterOnCellClick(click({ altKey: true }), { type })).toBe(
        false,
      )
    }
  })

  it('every other column type still filters on Alt-click', () => {
    for (const type of ['Data', 'Link', 'Select', 'Date', 'Dynamic Link']) {
      expect(shouldFilterOnCellClick(click({ altKey: true }), { type })).toBe(
        true,
      )
    }
  })
})
