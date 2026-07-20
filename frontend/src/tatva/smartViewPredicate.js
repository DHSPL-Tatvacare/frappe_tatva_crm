// TATVA: bridge the native Filter.vue emit shape <-> the Smart Views composer predicate tree.
//
// Filter.vue emits a flat dict keyed by fieldname (here: our catalog field_key):
//   { key: scalar }            for "equals" (a bare value; boolean for a Check field)
//   { key: [TOKEN, value] }    otherwise, TOKEN from frappe-ui's operatorMap ('LIKE','>','in','is',…)
//
// The composer (smartview/api.py) consumes a predicate tree of leaves:
//   { op:'and', conditions:[ { field, operator, value }, … ] }   operator from its own _OPS set.
//
// P2 builds a single flat AND group (that's all Filter.vue expresses); the composer already
// supports nested AND/OR for later. Every operator is passed through: the composer is the one place
// that decides what it can run, and it refuses rather than ignores.

// Filter TOKEN  ->  composer operator
const TOKEN_TO_OP = {
  '=': '=',
  '!=': '!=',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  LIKE: 'like',
  'NOT LIKE': 'not like',
  in: 'in',
  'not in': 'not in',
  // The control sends `between` for EVERY date field by default (getDefaultOperator) and `timespan`
  // for its named ranges. Dropping them made every date filter a no-op that said nothing.
  between: 'between',
  timespan: 'timespan',
}

// composer operator  ->  Filter TOKEN (for seeding the editor when editing an existing view)
const OP_TO_TOKEN = Object.fromEntries(
  Object.entries(TOKEN_TO_OP).map(([token, op]) => [op, token]),
)

export function filtersToPredicate(dict) {
  const conditions = []
  for (const [field, raw] of Object.entries(dict || {})) {
    let operator = '='
    let value = raw
    if (Array.isArray(raw)) {
      const [token, v] = raw
      if (token === 'is') {
        operator = v === 'not set' ? 'is not set' : 'is set'
        value = null
      } else if (TOKEN_TO_OP[token]) {
        operator = TOKEN_TO_OP[token]
        value = v
      } else {
        // The composer refuses an operator it cannot run, so passing it on surfaces a real error
        // instead of a list that silently ignored what the user asked for.
        operator = token
        value = v
      }
    } else if (typeof raw === 'boolean') {
      value = raw ? 1 : 0 // Check field equals -> 1/0
    }
    conditions.push({ field, operator, value })
  }
  return conditions.length ? { op: 'and', conditions } : null
}

export function predicateToFilters(tree) {
  const dict = {}
  for (const c of (tree && tree.conditions) || []) {
    if (!c || !c.field) continue
    const op = c.operator || '='
    if (op === 'is set') dict[c.field] = ['is', 'set']
    else if (op === 'is not set') dict[c.field] = ['is', 'not set']
    else if (op === '=') dict[c.field] = c.value
    else if (OP_TO_TOKEN[op]) dict[c.field] = [OP_TO_TOKEN[op], c.value]
  }
  return dict
}
