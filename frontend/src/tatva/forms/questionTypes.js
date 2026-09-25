// TATVA: Task Forms question types in the words an operator uses; the TYPES themselves come from the server's `question_types`.
const WORDS = {
  Data: 'Text',
  'Small Text': 'Long text',
  Select: 'Choice',
  Date: 'Date',
  Datetime: 'Date & time',
  Int: 'Whole number',
  Float: 'Number',
  Currency: 'Amount',
  Check: 'Yes / No',
  Link: 'Lookup',
  Attach: 'File',
  'Attach Image': 'Image',
}

// An unknown type shows its own name, so a type added to the doctype later still reads.
export const questionTypeLabel = (fieldtype) => __(WORDS[fieldtype] || fieldtype)
