import { evaluateDependsOnValue } from '@/utils'

// Trimmed like the server's `_field_visible`, or a leading space reads a whole expression as a bare fieldname.
const shown = (condition, values) =>
  !(condition || '').trim() ||
  evaluateDependsOnValue((condition || '').trim(), values)

// Every declared field present and blank until answered — the server seeds the same blanks.
export function withBlanks(fields, values) {
  const bag = {}
  for (const f of fields) bag[f.fieldname] = ''
  for (const [k, v] of Object.entries(values || {}))
    bag[k] = v === null || v === undefined ? '' : v
  return bag
}

// On screen when its own condition passes and every container holding it is open.
const fieldShown = (f, values) =>
  f.container_depends_on.every((c) => shown(c, values)) &&
  shown(f.depends_on, values)

// A container is open exactly when it still holds a shown field.
function walkVisible(layout, values) {
  const fields = new Set()
  const columns = new Set()
  const sections = new Set()
  const tabs = new Set()
  for (const tab of layout)
    for (const section of tab.sections)
      for (const column of section.columns)
        for (const f of column.fields)
          if (fieldShown(f, values)) {
            fields.add(f.fieldname)
            columns.add(column.key)
            sections.add(section.key)
            tabs.add(tab.key)
          }
  return { fields, columns, sections, tabs }
}

// D22, expressed once: the answers with every HIDDEN declared field read back blank. The server's `_inert`.
function inertValues(fields, values, shown) {
  const inert = { ...values }
  for (const f of fields) if (!shown.has(f.fieldname)) inert[f.fieldname] = ''
  return inert
}

// Must settle from the same start as the server or the fixpoint differs; the inert pass is what collapses a whole branch when its driver hides.
export function settleVisible(layout, fields, values) {
  let shownNames = new Set(fields.map((f) => f.fieldname))
  let settled
  for (let pass = 0; pass <= fields.length; pass++) {
    settled = walkVisible(layout, inertValues(fields, values, shownNames))
    if (
      settled.fields.size === shownNames.size &&
      [...settled.fields].every((n) => shownNames.has(n))
    )
      break
    shownNames = settled.fields
  }
  // The bag rides with the sets (the server's `_settled`), recomputed from the final set so a stalled fixpoint stays coherent.
  return { ...settled, live: inertValues(fields, values, settled.fields) }
}

// The server's `copied_values`, mirrored: judged off the SETTLED bag, first rule whose condition passes wins.
export function copiedValues(fields, visibility) {
  const out = {}
  for (const f of fields) {
    if (!visibility.fields.has(f.fieldname)) continue
    for (const rule of f.copy_from || []) {
      if (evaluateDependsOnValue(rule.when, visibility.live)) {
        out[f.fieldname] = visibility.live[rule.source] ?? ''
        break
      }
    }
  }
  return out
}

// The server's `_required_here`, mirrored; the `when &&` guard is load-bearing — a blank condition means "always".
export function requiredHere(f, visibility) {
  if (!visibility.fields.has(f.fieldname)) return false
  const when = (f.mandatory_depends_on || '').trim()
  return !!f.reqd || (!!when && evaluateDependsOnValue(when, visibility.live))
}
