// TATVA: Task Forms vocabulary read off the draft rows — what is a question, and what a question offers; one module, every tab.
import { isLayoutRow } from './layoutTree'

// A question is any row with a key that is not a layout row; a rule's WHEN, a copy source and the location rule ask only these.
export const isQuestion = (row) => Boolean(row.fieldname) && !isLayoutRow(row)

// Twin of the server's `_options_of` (crm_task_type.py): a Choice's options, trimmed, blank lines dropped.
export const choicesOf = (row) =>
  row?.fieldtype === 'Select'
    ? (row.options || '').split('\n').map((o) => o.trim()).filter(Boolean)
    : []

