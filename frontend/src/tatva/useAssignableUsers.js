// TATVA: who a lead may be assigned to (`lead.leads.assignable_users`: a Sales role covering its grain) — one answer for the header picker and the ⌘K palette.
import { createResource } from 'frappe-ui'

const resources = {}

// One resource per lead, in memory only: a `cache` key would write this record's answer to IndexedDB; callers reload it when a picker opens.
export function assignableUsers(lead) {
  return (resources[lead] ??= createResource({
    url: 'tatva_connect.lead.leads.assignable_users',
    params: { lead },
  }))
}
