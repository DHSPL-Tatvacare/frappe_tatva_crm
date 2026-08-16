// TATVA: the one client-side reader of the framework's `_link_titles` map, shared by every list view.
// A Link column stores the target's primary key. For our grain-scoped masters (CRM Lead Stage,
// CRM Task Type, CRM Picklist Value) that key is a composite `vertical::group::program::name`, so the
// cell must render the target's title_field instead. get_data ships `_link_titles` keyed
// `{doctype}::{pk}` for every Link whose target sets show_title_field_in_link; this reads it.
//
// The row keeps the PK, which is what the list filters, sorts and groups by. Resolving the title on
// the server and writing it back into the row would destroy that key: filtering would send the label
// and match nothing, and group-by would merge two stages that share a name across programs.

// The map covers Dynamic Link too, so a lead reference reads as a person's name on every listing page.
// The raw map lookup. Cells reach it through `linkTitle` (which knows a column); the group-by header
// reaches it with the target doctype it read off the list's own field list. One reader, two callers.
export function linkTitleFor(doctype, value, list) {
  if (!doctype || !value) return null
  return list?.data?._link_titles?.[`${doctype}::${value}`] || null
}

// A Link's target doctype is `column.options`; a Dynamic Link's `options` is a FIELDNAME, so the target
// is read off the ROW. Getting that backwards is what sent the Notes page off with a private copy.
export function linkTargetDoctype(column, row) {
  if (column?.type === 'Dynamic Link') return row?.[column?.options] || null
  if (column?.type === 'Link') return column?.options || null
  return null
}

// The map a DOCUMENT was loaded with, for a surface that provides it to its own controls. `get_workflow`
// ships one for the graph exactly as `get_doc_link_titles` does for a lead, and the canvas hands it to
// every node card through the same `provide('linkTitles')` the field layout uses. Named here, and only
// here, because this file is the one reader of that map.
export function docLinkTitles(doc) {
  return doc?._link_titles || {}
}

export function linkTitle(value, column, list, row) {
  const doctype = linkTargetDoctype(column, row)
  if (!doctype || !value) return null
  return linkTitleFor(doctype, value, list)
}

// --- the second source: a control with no list and no document behind it ---------------------------
//
// A `_link_titles` map only exists where a LIST or a DOCUMENT was loaded. The workflow canvas has
// neither — a node's Link value lives in its `config_json` — so `Create Task` showed the author
// `Goodflip-Care::Anaya::::Welcome Call` where every other surface in the CRM shows `Welcome Call`.
//
// The title is NOT derived here. `frappe.desk.search.search_link` already answers it: with
// `show_title_field_in_link` set, `build_for_autosuggest` (search.py:371-387) returns
// `{value: <pk>, label: <title>}` — the framework's own resolution, behind the framework's own
// permission gate. Splitting the PK on `::` in JS would have been a second brain, and a wrong one:
// the separator is an autoname format string the master owns, not a convention this file may assume.
//
// Memoised module-side and keyed by the THING (B2), so N controls holding one value ask once. The same
// shape `RemoteSelect.vue` already uses for its per-account agent detail — one cache, not one per instance.
import { reactive } from 'vue'
import { call } from 'frappe-ui'

export const linkTitles = reactive({})
const inFlight = new Map()

// Asked, answered, and the answer was "no such record". §9 forbids remembering a TRANSIENT failure and it
// is right — but this is not one: the request succeeded and the framework said the row does not exist. Not
// separating the two meant a value that can never resolve (a WhatsApp template nobody has created yet) was
// re-asked on every single canvas open, for ever. Session-scoped on purpose: create the record and the next
// page load asks again.
const answeredEmpty = new Set()

function cacheKey(doctype, value) {
  return `${doctype}::${value}`
}

// Whatever is known NOW — never a fetch, so a render path can read it without a side effect (§12).
export function knownLinkTitle(doctype, value) {
  if (!doctype || !value) return null
  return linkTitles[cacheKey(doctype, value)] || null
}

// {id: label} from the server's OWN two lists, which only their supplier may pair — positional anywhere else is a guess.
export function pairTitles(ids, labels) {
  const out = {}
  ;(Array.isArray(ids) ? ids : []).forEach((id, i) => {
    const label = (Array.isArray(labels) ? labels : [])[i]
    if (id && label) out[id] = label
  })
  return out
}

// The picker already drew this title to be chosen, so the answer is in hand and the chosen value never reads back as its composite PK.
export function rememberLinkTitle(doctype, value, label) {
  if (!doctype || !value || !label || label === value) return
  linkTitles[cacheKey(doctype, value)] = label
}

// Ask once per (doctype, value) and remember the answer. `search_link` is itself http-cached for 60s,
// so a repeat across a reload is free; the in-flight map is what stops a burst of controls stampeding.
// `scope` is the server's own {query, filters}: a target like `CRM Picklist Value` is readable ONLY through its scoped query, so a found title stays keyed on (doctype, value) — scope cannot change what a title IS — while "not found" is keyed WITH the scope, since a narrow miss must never silence a wider ask.
export function ensureLinkTitle(doctype, value, scope = {}) {
  if (!doctype || !value) return Promise.resolve(null)
  const key = cacheKey(doctype, value)
  const asked = `${key}::${scope.query || ''}::${JSON.stringify(scope.filters || [])}`
  if (linkTitles[key]) return Promise.resolve(linkTitles[key])
  if (answeredEmpty.has(asked)) return Promise.resolve(null)
  if (inFlight.has(asked)) return inFlight.get(asked)

  const request = call('frappe.desk.search.search_link', {
    doctype,
    txt: value,
    query: scope.query || null,
    filters: scope.filters || [],
    page_length: 1,
  })
    .then((rows) => {
      // A target that does not opt into `show_title_field_in_link` gets `label === value` from the
      // framework, so this stores the raw value and the control renders exactly as it does today.
      const found = (rows || []).find((r) => r.value === value)
      if (found?.label) linkTitles[key] = found.label
      else answeredEmpty.add(asked)
      return linkTitles[key] || null
    })
    // A title is decoration: a failed lookup leaves the raw value on screen and must never surface as
    // an error. Not cached either — a transient failure that stuck would blank the label for the session (§9).
    .catch(() => null)
    .finally(() => inFlight.delete(asked))

  inFlight.set(asked, request)
  return request
}

// Whether a picker may create its target inline. A grain- and category-scoped master is operator data whose key encodes a grain no picker can supply, so it is authored in the desk and never from a field — one rule, read by every control that offers a create.
export function mayCreateInline(doctype) {
  return Boolean(doctype) && doctype !== 'CRM Picklist Value'
}

// A subtitle repeating the composite PK is noise when its label is unique here, and the ONLY discriminator when four `Not Interested` stages are offered at once — so drop it on both counts, never by doctype and never by splitting on `::`.
export function optionDescriptions(rows) {
  const seen = {}
  for (const r of rows || []) {
    const label = r.label || r.value
    seen[label] = (seen[label] || 0) + 1
  }
  return (row) => {
    if (!row?.description) return null
    const label = row.label || row.value
    if (row.description === row.value && seen[label] === 1) return null
    return row.description
  }
}
