// TATVA: record actions on tatva_connect's one door (tatva_connect.api.record_actions): what a record offers, an action's form, its searches, running it and what earlier runs made; Helpdesk has the same pieces.
import { ref } from 'vue'

export const RECORD_ACTIONS_API = 'tatva_connect.api.record_actions'
// The form contract this dialog draws (record_actions.FORM_VERSION); the server offers actions only to a dialog that draws it.
export const FORM_VERSION = 2

// Bumped by every run that made something, so anything showing a record's links re-reads it.
export const recordActionsRan = ref(0)

// FormControl's type for the server field types it draws itself.
export const CONTROL = { Data: 'text', 'Small Text': 'textarea' }

// A field's empty value: nothing, or no values for a many-valued field.
export const emptyOf = (field) => (field.fieldtype === 'Tags' ? [] : null)
