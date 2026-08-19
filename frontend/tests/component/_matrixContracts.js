// One contract per CONTROL. `reason` says what the contract is FOR in the author's terms; `deferred` marks
// a control whose behaviour is proven elsewhere or not yet written, and the coverage spec prints those so a
// gap is visible in the report rather than absent from it.
//
// A contract is added here the moment a control is declared by any node — `coverage()` fails otherwise.
// Filling one in means writing the assertions in its own spec and dropping `deferred`.
export const CONTRACTS = {
  // --- proven, with their own spec -------------------------------------------------------------------
  predicate: {
    reason:
      'renders rules and groups, the X clears at the root and removes when nested, and nothing can be added with no fields to test',
    spec: 'PredicateBuilder.test.js',
  },
  'field-map': {
    reason: 'rows add and remove, the mode switch changes the editor, and only the written record’s fields are offered',
    spec: 'FieldMap.test.js',
  },
  duration: {
    reason: 'a delay is authored in the units add_to_date takes, never seconds',
    spec: 'DurationField.test.js',
  },

  // --- declared, contract not yet written ------------------------------------------------------------
  'value-picker': {
    reason:
      'offers upstream values grouped by source and keeps a saved reference that is no longer offered; NO publish check exists for these 7 fields, so this is the only gate',
    deferred: true,
  },
  'value-map': { reason: 'one row per declared slot, refetched when the template changes', deferred: true },
  instant: { reason: 'one value with one mode — the Wait’s literal instant is a calendar', deferred: true },
  'route-rows': { reason: 'N conditions tried top to bottom, plus Otherwise', deferred: true },
  'sample-rows': { reason: 'arms sum to 100 and a lead lands in the same arm every time', deferred: true },
  'button-list': { reason: 'each button declared here draws its own branch on a downstream Wait', deferred: true },
  mapping: { reason: 'captured names are refused when they collide with the engine namespace', deferred: true },
  'field-set': { reason: 'a display narrowing only — it must never change what publish accepts', deferred: true },
  link: {
    reason: 'all 12 are publish-checked and grain-scoped; the picker must offer only this workflow’s grain',
    deferred: true,
  },
  select: { reason: 'all 13 are publish-checked; options must equal the server’s, never a JS copy', deferred: true },
  'graph-select': {
    reason: 'targets, nodes and outcomes come from the one server answer — the JS copy was the second brain',
    deferred: true,
  },
  'remote-select': { reason: 'options are fetched server-side so no provider credential reaches the browser', deferred: true },
  grain: { reason: 'the three axes, scoped to what the author is entitled to', deferred: true },
  checkbox: { reason: 'a tick is stored as 0/1 and ships unticked', deferred: true },
  data: { reason: 'plain text; typing costs at most one debounced call', deferred: true },
  textarea: { reason: 'multi-line text; the expression variants are read by the publish gate', deferred: true },
  code: { reason: 'a JSON body whose $ctx references the publish gate must see at any depth', deferred: true },
  time: { reason: 'a time of day, stored in the shape the scheduler reads', deferred: true },
}
