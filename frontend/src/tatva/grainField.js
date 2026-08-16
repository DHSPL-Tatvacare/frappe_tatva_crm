// TATVA: a grain axis (vertical / group / programme) offers only the values present on records the caller
// can actually open, never the whole master — a scoped rep could otherwise read every other business line's
// programme names out of a filter dropdown, which measured 13 against the 1 they may work in.
//
// WHO decides, and WHERE: the SERVER, on the field, in the same catalog answer that declares the field
// (`lead/filters.py:stamp_grain_options`). A field is a grain axis iff it arrived carrying `grain_options`.
// So this file holds no fieldname list, no doctype list, and asks nothing — the classification and the
// values reach a control together, in one payload, and a control can never render before its own scoping.
//
// It replaced a second, parallel endpoint keyed on fieldname, which failed two ways nothing would have
// caught: it answered for CRM Lead only, so every other list page and activity tab that mounts the shared
// filter threw on mount; and a Smart View calls this same column `lead:program`, which no fieldname match
// could ever reach — that surface was serving the whole master. Both are properties of asking a SECOND
// source, not of the values, which is why the values now ride on the field.

// A field is a grain axis iff the catalog stamped it. An empty list is still an answer: this axis has no
// values on any record you can see. Absent is the other question — not an axis, leave the field alone.
export function isGrainField(field) {
  return Array.isArray(field?.grain_options)
}

// {label, value} for a frappe-ui select, with a blank first entry so the filter can be cleared.
export function grainSelectOptions(field) {
  return [
    { label: '', value: '' },
    ...(field?.grain_options || []).map((v) => ({ label: v, value: v })),
  ]
}
