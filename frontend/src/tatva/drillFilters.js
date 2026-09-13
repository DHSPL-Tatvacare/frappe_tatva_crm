// TATVA: judges the untrusted `?filters=` a drill arrives with. Shape only — get_list refuses unknown fieldnames itself. Malformed is dropped WHOLE, never half.
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

// TATVA: what a surface ARRIVED with, drill or preset. `filters` is null when none came; callers apply what they support.
export function readArrival(query) {
  const filters = parseDrillFilters(query?.filters)
  const sort = typeof query?.sort === 'string' && query.sort ? query.sort : ''
  return filters || sort ? { filters, sort } : null
}

// TATVA: drops what the arrival was carried in, so the list is the one source of truth from here.
export function dropArrival(route, router) {
  const { filters: _filters, sort: _sort, ...rest } = route.query
  router.replace({ name: route.name, params: route.params, query: rest })
}
