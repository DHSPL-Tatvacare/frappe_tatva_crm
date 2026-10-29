// TATVA: record actions on tatva_connect's one door (tatva_connect.api.record_actions): what a record offers, an action's form and running it; Helpdesk has the same pieces.
import { ref } from 'vue'

export const RECORD_ACTIONS_API = 'tatva_connect.api.record_actions'

// Bumped by every run that made something, so anything showing a record's links re-reads it.
export const recordActionsRan = ref(0)

// A server field's control in frappe-ui's FormControl.
export function controlOf(field) {
  if (field.fieldtype === 'Select') return 'select'
  return field.fieldtype === 'Small Text' ? 'textarea' : 'text'
}

// A field's options now: its own, or those that follow the field it names in options_by; an option is a value or {label, value}.
export function optionsOf(field, values) {
  const [on, byValue] = Object.entries(field.options_by || {})[0] || []
  const options = on ? byValue[String(values[on] ?? '')] || [] : field.options || []
  return options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o))
}
