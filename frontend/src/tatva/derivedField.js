// TATVA: the ONE frontend answer to "is this field derived, and what does that mean here?".
//
// The server decides and nothing here does: `tatva_connect/list_engine/derived.py` stamps `is_derived: 1`
// on the descriptor it announces, and every `get_data` payload (`fields`, `columns`, `group_by_field`) and
// every lens menu already carries it. So NO FIELDNAME appears in this file — a second derived field, on any
// doctype, is carried by the same call sites with no further edit, which is the whole point of the layer.
//
// A derived field is not a column. It cannot be WRITTEN — a kanban drag has nothing to set_value on — and it
// can only be FILTERED by what the engine composes out of the declaration's buckets. Both facts are the
// server's; this file is the safety net that stops a control offering what the server must refuse, and the
// one renderer for a value that is a bucket rather than a stored string.

// The primitive. Everything below asks THIS and never re-reads the stamp its own way.
export function isDerived(descriptor) {
  return !!descriptor?.is_derived
}

// The same question when all you hold is a list and a name — a payload's `fields`, or a lens menu.
// Unknown field, missing list or missing name all read false, so every real column takes the native path.
export function isDerivedField(fields, fieldname) {
  if (!fieldname || !Array.isArray(fields)) return false
  return isDerived(fields.find((f) => f?.fieldname === fieldname))
}

// What `ListRequest._chosen` composes out of the declared buckets: equality, set membership, and the empty
// case. It is the SAME five the Select menu offers (`Filter.vue:338-347`), so nothing is narrowed away
// today — the list exists so an operator the engine cannot serve is never offered either.
export const DERIVED_OPERATORS = ['equals', 'not equals', 'in', 'not in', 'is']

// The operator menu for one field. Narrowing only ever removes, and only for a derived field — a real
// column's menu is returned as it was built.
export function narrowOperators(options, fields, fieldname) {
  if (!isDerivedField(fields, fieldname)) return options
  return options.filter((o) => DERIVED_OPERATORS.includes(o.value))
}

// The filters a chip row is built from. Read off the params the REQUEST carries, never off a response: a
// filter the server refuses answers with no `list.data` at all, and the chip that would have removed the
// thing wedging the rep's list was the one that went missing. Same source when the response IS present.
export function appliedFilters(list) {
  return list?.params?.filters || list?.data?.params?.filters || null
}

// The quick-filter picker builds its menu from doctype META (`stores/meta.js` getFields), which has never
// heard of a derived field — so the settings dialog could never offer one. The column lens this page has
// already fetched carries the descriptors, in the same label/value/fieldtype shape the menu builds. The
// union is ADDITIVE and returns the caller's own array when it adds nothing, so a doctype that declares no
// derived field gets the identical list it got before.
export function withDerivedOptions(options, fields, taken = []) {
  const extra = (Array.isArray(fields) ? fields : [])
    .filter((f) => isDerived(f) && f.label && f.fieldname)
    .filter((f) => !taken.includes(f.fieldname))
    .filter((f) => !options.some((o) => o.value === f.fieldname))
    .map((f) => ({ label: f.label, value: f.fieldname, fieldtype: f.fieldtype }))
  return extra.length ? [...options, ...extra] : options
}

// `frappe.desk.reportview.export_query` is outside the engine: a derived name in `fields` or `order_by`
// throws there, and a derived filter is not understood at all — the rep got the wrong rows with no error.
// `args` is what `tatva_connect.api.list_export.export_args` answered, i.e. the SAME translation the list
// ran through; the bucket predicates are never re-expressed in JavaScript. The URL is otherwise assembled
// exactly as it always was, so an ordinary column's export is unchanged.
export function exportQueryUrl({
  doctype,
  fileFormat,
  args,
  pageLength,
  selectedItems,
}) {
  const fields = JSON.stringify(args?.fields || [])
  const filters = encodeURIComponent(JSON.stringify(args?.filters ?? {}))
  const orderBy = args?.order_by || ''
  let url = `/api/method/frappe.desk.reportview.export_query?file_format_type=${fileFormat}&title=${doctype}&doctype=${doctype}&fields=${fields}&filters=${filters}&order_by=${orderBy}&page_length=${pageLength}&start=0&view=Report&with_comment_count=1`
  if (selectedItems?.length) {
    url += `&selected_items=${JSON.stringify(selectedItems)}`
  }
  return url
}

// The colour the DECLARATION gives this bucket. The token set is the SERVER's — a colour no badge can wear is refused at Save — so nothing is filtered here and a second field needs no edit.
const authoredTheme = (descriptor, value) => descriptor?.themes?.[value] || null

// A derived value is a computed bucket, not a stored string, and it reads as a pill wherever it appears —
// the list cell, the kanban card and the group-by header all go through THIS renderer and no other.
// `descriptor` is the dict the payload carries; both halves are the SERVER'S — the bucket value it sent, and the theme that declaration authored.
export function derivedBadge(descriptor, value) {
  if (!isDerived(descriptor)) return null
  if (value === null || value === undefined || value === '') return null
  return { label: value, theme: authoredTheme(descriptor, value) || 'gray' }
}
