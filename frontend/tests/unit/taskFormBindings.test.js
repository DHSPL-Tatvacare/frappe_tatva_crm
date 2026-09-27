// A question's binding is the row Desk writes — Source, Section, Target and key — so each of the builder's bindings must write exactly that row.
import { describe, it, expect } from 'vitest'
import { bindRow, keyTail, newKey, questionType } from '@/tatva/forms/formVocabulary'

const TYPES = ['Data', 'Select', 'Datetime', 'Link', 'Attach']
const newAnswer = () => ({ label: 'Patient status', fieldname: newKey('Patient status'), fieldtype: 'Select', source: 'Activity' })

describe('task form bindings', () => {
  it('gives a new question a key that can never equal a lead field key, and keeps its tail as the label changes', () => {
    const key = newKey('First Name')
    expect(key).not.toBe('first_name')
    expect(key.startsWith('first_name_')).toBe(true)
    expect(newKey('First name given', keyTail(key))).toBe(`first_name_given_${keyTail(key)}`)
    expect(newKey('2nd visit date').startsWith('question_2nd_visit_date_')).toBe(true)
  })

  it('asks a lead field in its own type, or as Data when questions do not take that type', () => {
    expect(questionType(TYPES, { fieldtype: 'Link' })).toBe('Link')
    expect(questionType(TYPES, { fieldtype: 'Autocomplete' })).toBe('Data')
  })

  it('binds a lead field into the lead snapshot section under the lead key, as seeded lead questions are', () => {
    const row = bindRow(newAnswer(), { lead: { fieldname: 'first_name', label: 'First Name', fieldtype: 'Data' }, leadSection: 'lead_snapshot' }, TYPES)
    expect(row).toMatchObject({ source: 'Lead', section: 'lead_snapshot', target: '', fieldname: 'first_name', label: 'First Name', fieldtype: 'Data', options: '' })
  })

  it('binds a column into its section and target, and a question leaving a lead field takes a key of its own', () => {
    const lead = bindRow(newAnswer(), { lead: { fieldname: 'first_name', label: 'First Name', fieldtype: 'Data' }, leadSection: 'lead_snapshot' }, TYPES)
    const row = bindRow(lead, { section: 'engagement', target: 'activity_status' }, TYPES)
    expect(row).toMatchObject({ source: 'Activity', section: 'engagement', target: 'activity_status' })
    expect(row.fieldname).not.toBe('first_name')
  })

  it('returns a question to a new answer, keeping its own key and clearing where it was stored', () => {
    const row = bindRow(newAnswer(), { section: '', target: 'custom_followup_at' }, TYPES)
    const key = row.fieldname
    expect(bindRow(row, {}, TYPES)).toMatchObject({ source: 'Activity', section: '', target: '', fieldname: key })
  })
})
