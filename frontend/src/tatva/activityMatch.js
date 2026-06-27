// TATVA: one client-side predicate matcher shared by every activity tab (the Tasks board AND the
// Activities timeline). Mirrors the leaf operators the native Filter.vue -> filtersToPredicate emits,
// so a filter the user builds in the header applies identically wherever the items are rendered.
function s(x) {
  return (x == null ? '' : String(x)).toLowerCase()
}

export function matchCondition(item, c) {
  const v = item[c.field]
  const arr = Array.isArray(c.value) ? c.value : [c.value]
  switch (c.operator) {
    case '=':
      return s(v) === s(c.value)
    case '!=':
      return s(v) !== s(c.value)
    case 'like':
      return s(v).includes(s(c.value))
    case 'not like':
      return !s(v).includes(s(c.value))
    case 'in':
      return arr.map(s).includes(s(v))
    case 'not in':
      return !arr.map(s).includes(s(v))
    case 'is set':
      return v != null && v !== ''
    case 'is not set':
      return v == null || v === ''
    default:
      return true
  }
}

// AND of every leaf condition (Filter.vue expresses a single flat AND group).
export function passesFilter(item, predicate) {
  const conds = predicate?.conditions || []
  return conds.every((c) => matchCondition(item, c))
}
