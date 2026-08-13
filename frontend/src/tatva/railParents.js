// TATVA: the client half of `tatva_connect.activity.timeline.RAIL_PARENTS` — which records carry the
// patient surfaces (Tasks, Workflow, Data). ONE membership test, so widening a tab to deals is a
// declaration here and not a doctype comparison repeated once per tab.
export const RAIL_PARENTS = ['CRM Lead', 'CRM Deal']

// Does this record type carry the lead-shaped tabs at all?
export const isRailParent = (doctype) => RAIL_PARENTS.includes(doctype)

// The patient behind a record, read THROUGH `deal.lead` — a Deal is the customer a Lead became and
// copies nothing off it, so every lead-anchored surface (workflow journeys, activity types) asks for this.
export function patientLead(doctype, doc) {
  return (doctype === 'CRM Deal' ? doc?.lead : doc?.name) || ''
}
