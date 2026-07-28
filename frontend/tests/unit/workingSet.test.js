import { describe, it, expect } from 'vitest'
import {
  subjectKeyOf,
  narrowVariables,
  narrowSettable,
  workingSetOptions,
} from '@/tatva/valueOptions'
import wire from '../fixtures/nodeContext.wire.json'

// W3.1 — the working set. A DISPLAY narrowing declared on the Trigger: which of the subject's fields
// this workflow works with. Everything below is checked against `nodeContext.wire.json`, which was
// GENERATED from a live node_context response — see its `_generated` note. Nothing here hand-writes a
// `ref`, because the composition `<source><SEP><key>` belongs to refs.py and a second copy of it in a
// fixture would stay green while the real one drifted.
const { subject, nodeIds, variables, settable } = wire

// Read straight off the fixture rather than typed out, so the test cannot disagree with the wire.
const SUBSTAGE = variables.find((v) => v.label === 'Sub-stage')
const PATIENT_AGE = variables.find((v) => v.label === 'Patient Age')
const NODE_VALUE = variables.find((v) => v.source === 'call-api-1')

describe('subjectKeyOf — the one place a namespaced ref becomes a bare field key', () => {
  it('returns describe’s bare key for a subject field', () => {
    // Derived from the wire on both sides: the key must be exactly what `settable` calls the same field.
    expect(subjectKeyOf(SUBSTAGE, nodeIds)).toBe('custom_substage')
    expect(settable.some((f) => f.key === subjectKeyOf(SUBSTAGE, nodeIds))).toBe(true)
  })

  it('answers null for a value a NODE produced, so node values are never narrowed (rule 2)', () => {
    expect(subjectKeyOf(NODE_VALUE, nodeIds)).toBeNull()
  })

  it('answers null when the row carries no source at all, rather than a corrupted key', () => {
    // The rule form's builder_schema groups its fields under '' — a slice against an absent source must
    // degrade to "not a subject field", never to a mangled substring of the ref.
    expect(subjectKeyOf({ ref: 'status', label: 'Status', source: '' }, nodeIds)).toBeNull()
    expect(subjectKeyOf({ ref: 'status', label: 'Status' }, nodeIds)).toBeNull()
    expect(subjectKeyOf(undefined, nodeIds)).toBeNull()
  })
})

describe('narrowVariables — reads', () => {
  it('offers everything when the set is blank (rule 1 — blank means NO restriction)', () => {
    expect(narrowVariables(variables, [], nodeIds)).toHaveLength(variables.length)
    expect(narrowVariables(variables, undefined, nodeIds)).toHaveLength(variables.length)
  })

  it('keeps only the declared subject fields, and every node value (rule 2)', () => {
    const kept = narrowVariables(variables, ['custom_substage'], nodeIds)

    expect(kept.filter((v) => v.source === subjectSlug()).map((v) => v.ref)).toEqual([SUBSTAGE.ref])
    // all three Call API values survive untouched — they are the author's own nodes
    expect(kept.filter((v) => v.source === 'call-api-1')).toHaveLength(3)
  })

  it('does not narrow a workflow whose set names a field the subject no longer has (rule 3)', () => {
    // A stale entry narrows to nothing extra; it must not throw and must not empty the picker.
    const kept = narrowVariables(variables, ['custom_substage', 'a_field_that_left'], nodeIds)
    expect(kept.map((v) => v.ref)).toContain(SUBSTAGE.ref)
  })
})

describe('narrowSettable — writes, from the same one declaration', () => {
  it('offers everything when the set is blank', () => {
    expect(narrowSettable(settable, [], subject)).toHaveLength(settable.length)
  })

  it('keeps only the declared fields of the SUBJECT', () => {
    const kept = narrowSettable(settable, ['custom_patient_age'], subject)
    expect(kept.map((f) => f.key)).toEqual(['custom_patient_age'])
  })

  it('leaves a reachable OTHER record alone — its fields are not subject fields', () => {
    // `set_targets` spans every record a write can reach (describe.py:192). A CRM Task field reachable
    // from a lead-subject workflow is not what the author narrowed, so the set must not touch it.
    const withTask = [...settable, { key: 'status', label: 'Status', type: 'Select', doctype: 'CRM Task' }]
    const kept = narrowSettable(withTask, ['custom_patient_age'], subject)
    expect(kept.map((f) => `${f.doctype}.${f.key}`)).toEqual(['CRM Lead.custom_patient_age', 'CRM Task.status'])
  })
})

describe('workingSetOptions — what the Trigger control offers', () => {
  it('offers writable and read-only subject fields, deduped, and no node values', () => {
    const groups = workingSetOptions(variables, settable, subject, nodeIds)
    const values = groups.flatMap((g) => g.items.map((i) => i.value))

    // the backend really sends `custom_substage` twice in `settable`; the control must offer it once
    expect(values.filter((v) => v === 'custom_substage')).toHaveLength(1)
    // a field that is readable but NOT settable is still declarable
    expect(values).toContain('custom_screening_answers')
    // nothing a node produced belongs in a set of SUBJECT fields
    expect(values).not.toContain('status')
    expect(values.every((v) => !v.includes('call-api-1'))).toBe(true)
  })

  it('separates what may be written from what may only be read', () => {
    const groups = workingSetOptions(variables, settable, subject, nodeIds)
    const byGroup = Object.fromEntries(groups.map((g) => [g.group, g.items.map((i) => i.value)]))

    expect(byGroup['Writable']).toContain('custom_patient_age')
    expect(byGroup['Read only']).toContain('custom_screening_answers')
    expect(byGroup['Read only']).not.toContain('custom_patient_age')
  })

  it('labels a field the way the rest of the canvas labels it', () => {
    const groups = workingSetOptions(variables, settable, subject, nodeIds)
    const row = groups.flatMap((g) => g.items).find((i) => i.value === 'custom_patient_age')
    expect(row.label).toBe(PATIENT_AGE.label)
  })
})

// The slug the wire uses for the subject — read off the fixture, never rebuilt from the doctype name,
// because `frappe.scrub` is the backend's and nothing ships it to the browser.
function subjectSlug() {
  return variables.find((v) => v.label === 'Sub-stage').source
}
