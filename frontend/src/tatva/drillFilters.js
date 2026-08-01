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
