// Purpose: a ⌘K lead hit is its number and grain path (a typed ID takes the path's place, marked whole), and no indexed text renders as markup.
import { describe, it, expect } from 'vitest'
import { searchCommands } from '@/tatva/palette/searchCommands'
import { titleRuns } from '@/tatva/palette/paletteTypes'
import { grainLabel } from '@/tatva/useEntitledGrains'

const PATIENT_ID = 'TC-2024-0091'
const lead = {
  doctype: 'CRM Lead',
  name: 'lead-1',
  lead: 'lead-1',
  title: '<mark>Ramesh</mark> Kumar',
  snippet: '',
  phone: '+919876543210',
  vertical: 'Onco',
  group: 'ZZ Line',
  program: 'Advanced Care',
  stage: 'Patient Ready for Chemo',
}

const rowsOf = (results, totals = {}) => searchCommands({ results, totals }, 'rames')
const metaText = (row) => row.meta.map((part) => part.runs.map((r) => r.text).join('')).join(' · ')
const marks = (row) => row.meta.flatMap((part) => part.runs.filter((r) => r.match).map((r) => r.text))

describe('palette search rows', () => {
  it('draws the number, then the grain as ONE path, and hands the stage to the badge', () => {
    const [row] = rowsOf([lead])
    expect(metaText(row)).toBe(`${lead.phone} · ${grainLabel(lead)}`)
    expect(row.badge).toBe(lead.stage)
  })

  it('gives the grain path over to a typed ID, marked whole', () => {
    const [row] = rowsOf([{ ...lead, ident: { column: 'patient_id', label: 'Patient ID', value: PATIENT_ID } }])
    expect(metaText(row)).not.toContain(lead.program)
    expect(marks(row)).toEqual([PATIENT_ID])
    expect(row.meta[1].label).toBe('Patient ID')
  })

  it('marks the phone in place for a phone match, without repeating it', () => {
    const [row] = rowsOf([{ ...lead, ident: { column: 'phone', label: 'Mobile No', value: lead.phone } }])
    expect(marks(row)).toEqual([lead.phone])
    expect(metaText(row).split(lead.phone)).toHaveLength(2)
  })

  it('ignores a snippet on a lead row, so a wall of identifiers cannot come back', () => {
    const [row] = rowsOf([{ ...lead, snippet: `+919876543210 · ramesh@example.com · ${PATIENT_ID}` }])
    expect(metaText(row)).not.toContain(PATIENT_ID)
    expect(metaText(row)).not.toContain('@')
  })

  it("keeps the server's whole-token mark, and strips every other tag to text", () => {
    expect(titleRuns(lead.title).filter((r) => r.match).map((r) => r.text)).toEqual(['Ramesh'])
    const runs = titleRuns('<img src=x onerror="alert(1)">Ramesh <script>x</script><mark>kept</mark>')
    expect(runs.map((r) => r.text).join('')).toBe('Ramesh xkept')
  })

  it('degrades an unknown doctype to a plain row instead of throwing', () => {
    const [row] = rowsOf([{ doctype: 'CRM Task', name: 't-1', title: 'Call <mark>Ramesh</mark>', snippet: 'due today' }])
    expect(row.group).toBe('Other')
    expect(metaText(row)).toBe('due today')
  })

  it('caps a kind at its preview and drills into the rest with a Show all row', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ ...lead, name: `lead-${i}` }))
    const rows = rowsOf(five, { 'CRM Lead': 7 })
    expect(rows).toHaveLength(6)
    expect(rows[5].title).toContain('7')
    expect(rows[5].children).toBeTypeOf('function')
  })

  it('says a capped count is a floor, as the footer does', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ ...lead, name: `lead-${i}` }))
    const rows = searchCommands({ results: five, totals: { 'CRM Lead': 100 }, total_capped: true }, 'rames')
    expect(rows[5].title).toContain('100+')
  })
})
