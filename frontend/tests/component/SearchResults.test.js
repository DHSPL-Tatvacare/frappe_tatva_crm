// Purpose: the spotlight row is FOUR fixed slots (mobile · product line · group · program) plus ONE dynamic
// slot — the unique ID the server says was typed, marked WHOLE. A unique ID is input-only: it is never in the
// row's text, so nothing here can render a fragment of one.
//
// The other half is the highlight: the row renders the SERVER's <mark>, not a client re-highlight. FTS5
// prefix-matches `rames` to the whole token `Ramesh` and marks it; the regex that used to run here could only
// ever mark `Rames`. Only <mark> survives the sanitizer, because a note's content is user-entered text and
// reaches the DOM through v-html.
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import SearchResults from '@/components/SearchResults.vue'

const PATIENT_ID = 'TC-2024-0091'

// A lead row carries NO snippet — the server sends '' and the row is drawn from its metadata.
const lead = {
  doctype: 'CRM Lead',
  name: 'lead-1',
  lead: 'lead-1',
  title: '<mark>Ramesh</mark> Kumar',
  snippet: '',
  phone: '+919876543210',
  vertical: 'Onco',
  group: 'GoodFlip',
  program: 'Advanced Care',
  status: 'Screening',
}

const note = {
  doctype: 'FCRM Note',
  name: 'note-1',
  lead: 'lead-1',
  title: 'Ramesh Kumar',
  snippet: 'called about the <mark>refill</mark>',
}

const mount = (hits) =>
  mountTatva(SearchResults, { props: { hits, query: 'rames', tooShort: false, status: 'ready' } })

describe('SearchResults', () => {
  it("renders the server's whole-token mark, which the typed prefix could not produce", () => {
    const wrapper = mount([lead])
    const marks = wrapper.findAll('mark').map((m) => m.text())
    expect(marks).toContain('Ramesh')
    // The deleted client regex would have marked only the characters typed.
    expect(marks).not.toContain('Rames')
  })

  it('marks the snippet of a child row too', () => {
    const wrapper = mount([note])
    expect(wrapper.findAll('mark').map((m) => m.text())).toContain('refill')
  })

  it('draws the four fixed slots in order and no identifier among them', () => {
    const text = mount([lead]).text()
    for (const value of [lead.phone, lead.vertical, lead.group, lead.program]) {
      expect(text).toContain(value)
    }
    expect(text.indexOf(lead.vertical)).toBeLessThan(text.indexOf(lead.group))
    expect(text.indexOf(lead.group)).toBeLessThan(text.indexOf(lead.program))
    // No ID was typed, so no ID may be drawn — this is the wall of identifiers the batch removed.
    expect(text).not.toContain(PATIENT_ID)
    expect(text).not.toContain('@')
  })

  it('marks the WHOLE id in the dynamic slot, never a fragment of it', () => {
    const hit = { ...lead, title: 'Ramesh Kumar', ident: { column: 'patient_id', label: 'Patient ID', value: PATIENT_ID } }
    const wrapper = mount([hit])
    const marks = wrapper.findAll('mark').map((m) => m.text())
    expect(marks).toEqual([PATIENT_ID])
    expect(wrapper.text()).toContain('Patient ID')
  })

  it('marks the phone slot in place for a phone match, without repeating the number', () => {
    const wrapper = mount([{ ...lead, title: 'Ramesh Kumar', ident: { column: 'phone', label: 'Mobile No', value: lead.phone } }])
    expect(wrapper.findAll('mark').map((m) => m.text())).toEqual([lead.phone])
    expect(wrapper.text().split(lead.phone)).toHaveLength(2)
    expect(wrapper.text()).not.toContain('Mobile No')
  })

  it('keeps mark and drops any other tag from server text', () => {
    const wrapper = mount([{ ...note, snippet: '<b>bold</b> <mark>kept</mark>' }])
    expect(wrapper.html()).not.toContain('<b>')
    expect(wrapper.text()).toContain('bold')
    expect(wrapper.findAll('mark').map((m) => m.text())).toContain('kept')
  })

  it('drops a script and an event handler that reached the snippet', () => {
    // One disallowed tag per case on purpose: happy-dom's NodeIterator stops walking after DOMPurify removes
    // a node, so a second removal in the same string is not observable in this environment (browsers are fine).
    expect(mount([{ ...note, snippet: '<script>alert(1)</script>plain' }]).html()).not.toContain('<script')
    expect(mount([{ ...note, title: '<img src=x onerror="alert(1)">Ramesh' }]).html()).not.toContain('onerror')
  })

  it('never interprets an ident value as markup — it is text, not v-html', () => {
    const wrapper = mount([{ ...lead, title: 'Ramesh Kumar', ident: { column: 'patient_id', label: 'Patient ID', value: '<script>x</script>' } }])
    expect(wrapper.html()).not.toContain('<script')
  })

  // The RED proof for the row shape, made permanent: the line this replaced rendered the server's snippet for
  // a lead, and that snippet was mobile · email · patient id · prospect id — a wall of identifiers on every
  // row. A lead row now ignores `snippet` outright, so the wall cannot come back through the server either.
  it('ignores a snippet on a lead row entirely, so a wall of identifiers cannot come back', () => {
    const wall = `+919876543210 · ramesh@example.com · ${PATIENT_ID}`
    const text = mount([{ ...lead, title: 'Ramesh Kumar', snippet: wall }]).text()
    expect(text).not.toContain(PATIENT_ID)
    expect(text).not.toContain('@')
  })

  // The RED proof, made permanent: the deleted client regex, reconstructed here. It cannot reproduce an FTS5
  // prefix match, so the assertion above ("Ramesh" is marked, "Rames" is not) was red on the old code.
  it('the client regex it replaced could only ever mark the characters typed', () => {
    const stripMark = (s) => (s || '').replace(/<\/?mark>/g, '')
    const old = (text, term) => stripMark(text).replace(new RegExp(`(${term})`, 'ig'), '<mark>$1</mark>')
    expect(old(lead.title, 'rames')).toContain('<mark>Rames</mark>')
    expect(old(lead.title, 'rames')).not.toContain('<mark>Ramesh</mark>')
  })
})
