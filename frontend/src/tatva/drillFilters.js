// TATVA: judges `?filters=` — the one piece of UNTRUSTED input the list layer reads. Shape only; it reaches frappe.get_list, which refuses unknown fieldnames itself. Malformed is dropped WHOLE, never partly.

// A drill is page one of a new question; the list otherwise resends the 200 rows a user had grown it to.
export const DRILL_PAGE_LENGTH = 20

export function parseDrillFilters(raw) {
  if (typeof raw !== 'string' || !raw) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const keys = Object.keys(parsed)
  if (!keys.length) return null
  if (keys.some((key) => !key || key.includes('.'))) return null
  return parsed
}

// A drill is a one-off question and must never land in the user's saved default list; updateFilter persists unconditionally otherwise.
export function shouldPersistFilterChange(persist, routeQuery) {
  if (persist === false) return false
  if (routeQuery?.view) return false
  return !parseDrillFilters(routeQuery?.filters)
}
