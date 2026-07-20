// TATVA: the ONE way a picker turns the authoring contract into Autocomplete options.
//
// Three components built this list independently — `NodeInspector.pickOptions`, `PredicateBuilder`
// and `RequirementList` each wrote `fields.map((f) => ({ label: f.label, value: f.key }))`. Three
// copies of one rule is how a picker starts disagreeing with the picker beside it, and under the
// namespaced value contract a flat list is actively wrong: `crm_lead.status` and `api.status` are
// two different values, and a flat list renders them as two rows both labelled `Status`.
//
// So: the LABEL is human and never routes; the VALUE is the namespaced ref; the GROUP says which
// record or node produced it. The group heading is `source_label`, decided by `upstream.available_at`
// — this module never derives it, because only the backend knows that `api` is a Call API the author
// named and `crm_lead` is the subject.
//
// Shape is frappe-ui's own grouped-options contract: `[{ group, items: [{ label, value, description }] }]`.

// Values a node may READ — from `node_context.variables`, already namespaced and grouped by source.
export function valueRows(variables) {
  return (variables || []).map((v) => ({
    label: v.label || v.key,
    value: v.key,
    group: v.source_label || v.source || '',
    description: v.key,
  }))
}

// Fields a node may WRITE — from `node_context.settable`. A different question with a different
// brain (`describe.set_targets`), so it carries the record as `doctype` rather than a value source.
// Adapting it here rather than making the backends identical keeps each brain answering its own
// question, which is what they are for.
export function fieldRows(settable) {
  return (settable || []).map((f) => ({
    label: f.label || f.key,
    value: f.key,
    group: f.doctype || '',
    description: f.key,
  }))
}

// Rows in, grouped options out. Insertion order is preserved and never re-sorted: the backend hands
// values back nearest-ancestor first, and a second ordering here would be a second opinion about
// which value an author is most likely to want.
//
// `selected` is prepended as its own group when it is no longer on offer. A rewired graph used to
// blank the control silently, and the next save PERSISTED that erasure — the author was never told a
// reference had died. A stale row is ugly on purpose.
export function groupedOptions(rows, selected) {
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
    groups.unshift({
      group: __('No longer available'),
      items: [{ label: selected, value: selected, description: __('Nothing produces this value now') }],
    })
  }
  return groups
}

// The label to show for a saved value — the human name when it is on offer, the raw ref when it is
// not, so a dead reference reads as what it is instead of as an empty box.
export function labelOf(rows, value) {
  return rows.find((r) => r.value === value)?.label || value || ''
}
