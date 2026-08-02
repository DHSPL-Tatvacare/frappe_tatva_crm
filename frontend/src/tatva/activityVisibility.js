import { evaluateDependsOnValue } from '@/utils'

const shown = (condition, values) =>
  !condition || evaluateDependsOnValue(condition, values)

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

// Must settle from the same start as the server or the fixpoint differs; the inert pass is what collapses a whole branch when its driver hides.
export function settleVisible(layout, fields, values) {
  let shownNames = new Set(fields.map((f) => f.fieldname))
  let settled
  for (let pass = 0; pass <= fields.length; pass++) {
    const inert = { ...values }
    for (const f of fields)
      if (!shownNames.has(f.fieldname)) inert[f.fieldname] = ''
    settled = walkVisible(layout, inert)
    if (
      settled.fields.size === shownNames.size &&
      [...settled.fields].every((n) => shownNames.has(n))
    )
      break
    shownNames = settled.fields
  }
  return settled
}
