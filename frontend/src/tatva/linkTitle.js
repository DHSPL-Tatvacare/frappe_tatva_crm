// TATVA: the one client-side reader of the framework's `_link_titles` map, shared by every list view.
// A Link column stores the target's primary key. For our grain-scoped masters (CRM Lead Stage,
// CRM Task Type, CRM Picklist Value) that key is a composite `vertical::group::program::name`, so the
// cell must render the target's title_field instead. get_data ships `_link_titles` keyed
// `{doctype}::{pk}` for every Link whose target sets show_title_field_in_link; this reads it.
//
// The row keeps the PK, which is what the list filters, sorts and groups by. Resolving the title on
// the server and writing it back into the row would destroy that key: filtering would send the label
// and match nothing, and group-by would merge two stages that share a name across programs.

// The raw map lookup. Cells reach it through `linkTitle` (which knows a column); the group-by header
// reaches it with the target doctype it read off the list's own field list. One reader, two callers.
export function linkTitleFor(doctype, value, list) {
  if (!doctype || !value) return null
  return list?.data?._link_titles?.[`${doctype}::${value}`] || null
}

export function linkTitle(value, column, list) {
  if (column?.type !== 'Link' || !column?.options || !value) return null
  return linkTitleFor(column.options, value, list)
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

function cacheKey(doctype, value) {
  return `${doctype}::${value}`
}

// Whatever is known NOW — never a fetch, so a render path can read it without a side effect (§12).
export function knownLinkTitle(doctype, value) {
  if (!doctype || !value) return null
  return linkTitles[cacheKey(doctype, value)] || null
}

// Ask once per (doctype, value) and remember the answer. `search_link` is itself http-cached for 60s,
// so a repeat across a reload is free; the in-flight map is what stops a burst of controls stampeding.
export function ensureLinkTitle(doctype, value) {
  if (!doctype || !value) return Promise.resolve(null)
  const key = cacheKey(doctype, value)
  if (linkTitles[key]) return Promise.resolve(linkTitles[key])
  if (inFlight.has(key)) return inFlight.get(key)

  const request = call('frappe.desk.search.search_link', { doctype, txt: value, page_length: 1 })
    .then((rows) => {
      // A target that does not opt into `show_title_field_in_link` gets `label === value` from the
      // framework, so this stores the raw value and the control renders exactly as it does today.
      const found = (rows || []).find((r) => r.value === value)
      if (found?.label) linkTitles[key] = found.label
      return linkTitles[key] || null
    })
    // A title is decoration: a failed lookup leaves the raw value on screen and must never surface as
    // an error. Not cached either — a transient failure that stuck would blank the label for the session (§9).
    .catch(() => null)
    .finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}
