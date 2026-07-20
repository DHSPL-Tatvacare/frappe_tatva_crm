// TATVA: the ONE grouper — label is human, value is the namespaced ref, group is the server's source_label.

// Values a node may READ — from `node_context.variables`, already namespaced and grouped by source.
export function valueRows(variables) {
  return (variables || []).map((v) => ({
    label: v.label || v.key,
    value: v.key,
    group: v.source_label || v.source || '',
    description: v.key,
  }))
}

// Fields a node may WRITE — from `node_context.settable`, a different brain that groups by record.
export function fieldRows(settable) {
  return (settable || []).map((f) => ({
    label: f.label || f.key,
    value: f.key,
    group: f.doctype || '',
    description: f.key,
  }))
}

// Order is the server's; a `selected` value no longer offered is prepended rather than silently blanked.
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

// The human name when a value is on offer, the raw ref when it is not, so a dead reference reads as itself.
export function labelOf(rows, value) {
  return rows.find((r) => r.value === value)?.label || value || ''
}
