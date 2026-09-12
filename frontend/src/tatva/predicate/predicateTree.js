// TATVA: the predicate TREE — its shape, its rules, and nothing about any screen.
//
// One tree serves every surface that has conditions (Smart Views today, a form builder next, the
// automation builder when it comes across), so the shape lives on its own rather than inside whichever
// component happened to need it first:
//
//     group = { op: 'and' | 'or' | 'not', conditions: [ node, … ] }
//     leaf  = { field, operator, value }            (+ from_value, when the operator takes a range)
//
// `and` is the default everywhere — a group carrying no `op` means `and`, which is what
// `smartview/query.py` already does — so a predicate saved before the joiner existed keeps its meaning.
//
// PURE. Every function takes a tree and returns a NEW one; nothing mutates its argument and nothing
// reaches for a component, a store or a request. That is what makes it testable on its own, and what
// stops the next host growing a second copy of "what counts as a group".
//
// Deliberately small: a path-addressed edit API (nodeAt/replaceAt/insertAt/…) was written here first and
// then deleted unused, because PredicateGroup owns its own subtree through v-model and never needed to
// address a node by path. An API kept "for later" is an API nobody has tested.

export function isGroup(node) {
  return !!node && Array.isArray(node.conditions)
}

// A group's op, defaulted the way the server defaults it.
export function opOf(node) {
  return (node?.op || 'and').toLowerCase()
}

export function emptyGroup(op = 'and') {
  return { op, conditions: [] }
}

export function leaf(field, operator, value = '') {
  return { field, operator, value }
}

// Every leaf in the tree, with its path — what a host walks to report which conditions are unfinished.
export function leaves(node, path = []) {
  if (!node) return []
  if (!isGroup(node)) return [{ node, path }]
  return node.conditions.flatMap((c, i) => leaves(c, [...path, i]))
}

// An empty group carries no meaning, so it comes back as null rather than as a group with nothing in it.
// The server reads "no predicate" and "a predicate matching everything" the same way, and null is the
// honest one: it is what the author actually left behind.
export function prune(node) {
  if (!node) return null
  if (!isGroup(node)) return node
  const conditions = node.conditions.map(prune).filter(Boolean)
  return conditions.length ? { ...node, conditions } : null
}
