// TATVA: the `frappe.scrub` shape (`Follow-up At` -> `follow_up_at`) for keys the engine addresses — one namer, every surface.
export function scrub(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
}
