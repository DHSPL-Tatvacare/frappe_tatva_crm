// TATVA: Task Forms vocabulary read off the draft rows — what is a question, what it offers, what its key is and what it is bound to; one module, every tab.
import { isLayoutRow } from './layoutTree'
import { scrub } from '@/tatva/scrub'
import { getRandom } from '@/utils'

// A question is any row with a key that is not a layout row; a rule's WHEN, a copy source and the location rule ask only these.
export const isQuestion = (row) => Boolean(row.fieldname) && !isLayoutRow(row)

// Twin of the server's `_options_of` (crm_task_type.py): a Choice's options, trimmed, blank lines dropped.
export const choicesOf = (row) =>
  row?.fieldtype === 'Select'
    ? (row.options || '').split('\n').map((o) => o.trim()).filter(Boolean)
    : []

// A new question's own key: its label as a key with a random tail, so it never equals a lead field's key; the tail is kept as the label changes.
export const newKey = (label, tail = getRandom().toLowerCase()) => `${scrub(label) || 'question'}_${tail}`
export const keyTail = (key) => (key || '').slice((key || '').lastIndexOf('_') + 1)

// A lead field's type as a question takes it; one the question types do not list is asked as Data.
export const questionType = (types, field) => (types.includes(field.fieldtype) ? field.fieldtype : 'Data')

// Binds a question as Desk's Source, Section and Target write it: `lead` reads that lead field into the lead snapshot section under
// the lead's own key; otherwise the question answers under its own key, in `section`/`target` when given, else the general answers.
export function bindRow(row, { lead, leadSection, section = '', target = '' }, types) {
  if (lead) {
    return Object.assign(row, {
      source: 'Lead',
      section: leadSection,
      target: '',
      fieldname: lead.fieldname,
      label: lead.label,
      fieldtype: questionType(types, lead),
      options: '',
    })
  }
  const fieldname = row.source === 'Lead' ? newKey(row.label || row.fieldtype) : row.fieldname
  return Object.assign(row, { source: 'Activity', section, target, fieldname })
}
