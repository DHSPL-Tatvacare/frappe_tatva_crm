// TATVA: the one client reader of `_link_titles` ({doctype}::{pk} → title), so a Link shows its title while the row keeps the PK it filters and sorts by.

// The raw map lookup (Dynamic Link included), used by cells via `linkTitle` and by the group-by header.
export function linkTitleFor(doctype, value, list) {
  if (!doctype || !value) return null
  return list?.data?._link_titles?.[`${doctype}::${value}`] || null
}

// A Link's target is `column.options`; a Dynamic Link's `options` is a fieldname, so its target is read off the row.
export function linkTargetDoctype(column, row) {
  if (column?.type === 'Dynamic Link') return row?.[column?.options] || null
  if (column?.type === 'Link') return column?.options || null
  return null
}

// The map a document was loaded with (e.g. a lead or a workflow graph), for a surface that provides it to its controls.
export function docLinkTitles(doc) {
  return doc?._link_titles || {}
}

// `pageLinkTitles`/`mergedTitleSource` archived in frappe_tatva_connect/.archive/crm-fork-tatva: Smart View Load More widens one window, so no page maps are merged.
export function linkTitle(value, column, list, row) {
  const doctype = linkTargetDoctype(column, row)
  if (!doctype || !value) return null
  return linkTitleFor(doctype, value, list)
}

// --- second source: a control with no list or document behind it, resolved by `search_link` (never by splitting the PK), memoised module-side ---
import { reactive } from 'vue'
import { call } from 'frappe-ui'

export const linkTitles = reactive({})
const inFlight = new Map()

// Lookups that succeeded with "no such record" (not transient failures), remembered for the session only.
const answeredEmpty = new Set()

function cacheKey(doctype, value) {
  return `${doctype}::${value}`
}

// Whatever is known now — never a fetch, so a render path can read it without a side effect.
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

// Asks once per (doctype, value), de-duplicating in-flight calls; a found title is keyed without `scope`, a miss with it so a narrow miss never silences a wider ask.
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
      // A target without `show_title_field_in_link` answers `label === value`, so the raw value renders as before.
      const found = (rows || []).find((r) => r.value === value)
      if (found?.label) linkTitles[key] = found.label
      else answeredEmpty.add(asked)
      return linkTitles[key] || null
    })
    // A title is decoration: a failed lookup leaves the raw value, raises nothing, and is not cached.
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
