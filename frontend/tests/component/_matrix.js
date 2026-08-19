// The control matrix: every (node type, config field) the engine declares, and the contract its CONTROL
// must satisfy. Written once per control and applied to every instance — expectations belong to the
// control, not to the node that happens to carry it.
//
// The list is the REGISTRY'S OWN, via `_nodeTypes.fixture.json`, which
// `test_control_matrix_fixture.py` keeps honest. So a node type added tomorrow appears here without anyone
// editing this file — and if nobody wrote a contract for its control, `coverage()` reports it and the
// matrix suite FAILS. Silence is the failure mode this exists to remove: a suite that quietly skips what it
// does not understand is worth less than no suite.
import fixture from './_nodeTypes.fixture.json'

export const NODE_TYPES = fixture.node_types

// [{node, field, control, reqd, gatedBy}] — one row per declared config field, in declaration order.
export const TUPLES = NODE_TYPES.flatMap((n) =>
  (n.config || []).map((f) => ({
    node: n.type,
    field: f.name,
    control: f.control,
    reqd: !!f.reqd,
    gatedBy: f.depends_on_value ? Object.keys(f.depends_on_value) : null,
  })),
)

export const CONTROLS = [...new Set(TUPLES.map((t) => t.control))].sort()

// Tuples whose value is written by a sibling's choice. The morph surface, and the one that produced the
// `Only when` dead end: a control reached in a state nobody designed for.
export const GATED = TUPLES.filter((t) => t.gatedBy)

// A control is COVERED when a contract names it. `reason` is required and is not decoration: an unwritten
// contract and a deliberately-deferred one look identical in a pass/fail count, and only one of them is a
// problem.
export function coverage(contracts) {
  const named = new Set(Object.keys(contracts))
  const missing = CONTROLS.filter((c) => !named.has(c))
  const stale = [...named].filter((c) => !CONTROLS.includes(c))
  const deferred = Object.entries(contracts)
    .filter(([, v]) => v.deferred)
    .map(([k, v]) => `${k}: ${v.reason}`)
  return {
    controls: CONTROLS.length,
    tuples: TUPLES.length,
    gated: GATED.length,
    covered: CONTROLS.length - missing.length,
    missing,
    stale,
    deferred,
  }
}

export const instancesOf = (control) => TUPLES.filter((t) => t.control === control)
