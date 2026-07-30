// TATVA: the ONE grouper — label is human, value is the namespaced ref, group is the server's source_label.

// Values a node may READ — from `node_context.variables`. A namespaced reference is a `ref` on the wire,
// the same word the engine uses for what a node WRITES, because it is the same string.
export function valueRows(variables) {
  return (variables || []).map((v) => ({
    label: v.label || v.ref,
    value: v.ref,
    group: v.source_label || v.source || '',
    description: v.ref,
  }))
}

// Fields a node may WRITE — from `node_context.settable`, a different brain that groups by record. Its
// `key` is `describe`'s own BARE field name, not a namespaced ref, so it keeps describe's word.
export function fieldRows(settable) {
  return (settable || []).map((f) => ({
    label: f.label || f.key,
    value: f.key,
    group: f.doctype || '',
    description: f.key,
  }))
}

// Order is the server's; a `selected` value no longer offered is prepended rather than silently blanked.
//
// `known` is every row that still RESOLVES, offered or not — which after W3.1 is a different set from
// what is offered. Two reasons a selection can be missing from `rows`, and they are not the same thing:
// the value is genuinely gone, or the working set simply does not name it. The second is not a fault,
// so it keeps its real label; only the first degrades to reading as its own raw ref. Without this a
// narrowing turned every out-of-set reference into `crm_lead.mobile_no` on screen — still resolving,
// exactly as rule 3 requires, but no longer legible, which is its own kind of broken.
export function groupedOptions(rows, selected, known = []) {
  const groups = []
  const byName = new Map()
  for (const row of rows) {
    if (!byName.has(row.group)) {
      const group = { group: row.group, hideLabel: !row.group, items: [] }
      byName.set(row.group, group)
      groups.push(group)
    }
    byName.get(row.group).items.push(row)
  }

  if (selected && !rows.some((r) => r.value === selected)) {
    const resolvable = known.find((r) => r.value === selected)
    groups.unshift(
      resolvable
        ? { group: __('Not in this workflow’s fields'), items: [resolvable] }
        : {
            group: __('No longer available'),
            items: [{ label: selected, value: selected, description: __('Nothing produces this value now') }],
          },
    )
  }
  return groups
}

// The human name when a value is on offer, the raw ref when it is not, so a dead reference reads as itself.
export function labelOf(rows, value) {
  return rows.find((r) => r.value === value)?.label || value || ''
}

// The wire variable a picked value came from — the exact reverse of `valueRows`, and here rather than in
// each consumer so the identity of a variable is stated ONCE. A picker emits `v.ref`; anything that then
// needs the variable's `type` has to look it up by the same word. PredicateBuilder looked it up by `key`,
// which W2.3 had already renamed away, so every workflow predicate resolved `undefined` — an empty
// operator select and a plain-text value box — while the field dropdown above it kept working.
export function variableFor(variables, value) {
  return (variables || []).find((v) => v.ref === value) || null
}

// --- W3.1, the working set ------------------------------------------------------------------------
//
// The author declares on the Trigger which of the SUBJECT's fields a workflow works with, and every
// picker below offers those. It is a DISPLAY narrowing: `node_context` answers what was declared and
// filters nothing, so run state still falls through to the live document and publish still accepts any
// real field. Nothing here may become an enforcement surface — that would be two answers to "what may
// be read".
//
// The set stores describe's BARE keys, because that is what a set of a doctype's fields is. Reads speak
// namespaced `ref`s and writes speak bare `key`s — two vocabularies on purpose (refs.py:145) — so ONE
// side needs a conversion and this is it. It lives here, once, in the file that already owns what
// identifies a picker row.

// THE conversion, and the only place a ref is ever taken apart on this side of the wire. It does not
// hunt for a separator: the wire hands over `source`, and a subject ref is `source + <SEP> + key`, so
// the boundary is given rather than guessed. Returns null for anything that is NOT a subject field —
// a value a node produced (rule 2: never narrowed, they are the author's own nodes), or a row with no
// source at all (the rule form's builder_schema groups under ''), which degrades to no narrowing rather
// than to a mangled substring.
//
// C17.1 — "did a node produce this" is READ off the row, never re-decided here. It used to be answered
// by scanning the canvas's raw `graph` prop for the source id, which is a backend answer recomputed on
// the client; `upstream._shaped` now says `emitted` on every row, so the id list is not needed at all.
export function subjectKeyOf(variable) {
  const source = variable?.source
  if (!source || !variable.ref) return null
  if (variable.emitted) return null
  return variable.ref.slice(source.length + 1) || null
}

// Blank set = NO restriction, the same semantic a blank grain axis already carries.
function declared(workingSet) {
  return workingSet?.length ? workingSet : null
}

export function narrowVariables(variables, workingSet) {
  const set = declared(workingSet)
  if (!set) return variables || []
  return (variables || []).filter((v) => {
    const key = subjectKeyOf(v)
    return key === null || set.includes(key)
  })
}

// The write side needs no conversion — `settable` already speaks bare keys. It spans every record a
// write can REACH (describe.py:192), so only rows belonging to the subject are narrowed: a CRM Task
// field reachable from a lead-subject workflow is not one of the subject fields the author declared.
export function narrowSettable(settable, workingSet, subject) {
  const set = declared(workingSet)
  if (!set) return settable || []
  return (settable || []).filter((f) => f.doctype !== subject || set.includes(f.key))
}

// What the Trigger's own control offers: every subject field, whether it may be written or only read.
// Offering `settable` alone would make a read-only field undeclarable — a narrowing that HIDES rather
// than tidies. Deduped by key because the backend really does send the same settable row twice.
export function workingSetOptions(variables, settable, subject) {
  const rows = []
  const seen = new Set()
  const add = (value, label, group) => {
    if (!value || seen.has(value)) return
    seen.add(value)
    rows.push({ label: label || value, value, group, description: value })
  }

  for (const f of settable || []) {
    if (f.doctype === subject) add(f.key, f.label, __('Writable'))
  }
  for (const v of variables || []) {
    add(subjectKeyOf(v), v.label, __('Read only'))
  }
  return groupedOptions(rows, null)
}
