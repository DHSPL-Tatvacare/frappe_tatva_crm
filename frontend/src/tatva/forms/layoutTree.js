// TATVA: Task Forms layout — binds `builder_doc`'s walk (the engine's own `layout_tree`) to the draft rows and writes it back; never walks rows itself.

// The server's tree names each row; bound, every node holds the draft row object (null = implicit container).
export function bindLayout(layout, schema) {
  const byName = new Map(schema.map((r) => [r.name, r]))
  // A name with no row would be dropped from the save, and a dropped child row is deleted — refuse instead.
  const row = (name) => {
    if (!name) return null
    if (!byName.has(name)) throw new Error(`Task Forms: layout names an unknown row ${name}`)
    return byName.get(name)
  }
  return layout.map((tab) => ({
    row: row(tab.row),
    sections: tab.sections.map((section) => ({
      row: row(section.row),
      columns: section.columns.map((column) => ({
        row: row(column.row),
        fields: column.fields.map(row),
      })),
    })),
  }))
}

// Back to the `schema` child table in tree order, `idx` renumbered; an implicit container writes no row.
export function flattenLayout(tabs) {
  const rows = []
  const add = (r) => r && rows.push(r)
  for (const tab of tabs) {
    add(tab.row)
    for (const section of tab.sections) {
      add(section.row)
      for (const column of section.columns) {
        add(column.row)
        column.fields.forEach(add)
      }
    }
  }
  return rows.map((r, i) => ({ ...r, idx: i + 1 }))
}
