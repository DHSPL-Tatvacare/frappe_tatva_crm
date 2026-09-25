// TATVA: Task Forms layout — binds `builder_doc`'s walk (the engine's own `layout_tree`) to the draft rows and writes it back; never walks rows itself.

// The server's tree names each row; bound, every node holds the draft row (null = implicit container) plus the `name`/`label` `FieldLayoutEditor` reads.
export function bindLayout(layout, schema) {
  const byName = new Map(schema.map((r) => [r.name, r]))
  // A name with no row would be dropped from the save, and a dropped child row is deleted — refuse instead.
  const row = (name) => {
    if (!name) return null
    if (!byName.has(name)) throw new Error(`Task Forms: layout names an unknown row ${name}`)
    return byName.get(name)
  }
  let n = 0
  // `label` reads and writes the row itself, so a rename in the editor is the row's rename.
  const node = (name, children) => {
    const r = row(name)
    return {
      row: r,
      name: r ? r.name : `implicit-${++n}`,
      get label() {
        return r ? r.label || '' : ''
      },
      set label(value) {
        if (r) r.label = value
      },
      ...children,
    }
  }
  // An EMPTY implicit container writes no row and the server regrows it, so it goes — unless it is its parent's only child.
  const kept = (c, i, all) => c.row || all.length === 1 || (c.fields || c.columns || c.sections).length
  return layout
    .map((tab) =>
      node(tab.row, {
        sections: tab.sections
          .map((section) =>
            node(section.row, {
              columns: section.columns
                .map((column) => node(column.row, { fields: column.fields.map(row) }))
                .filter(kept),
            }),
          )
          .filter(kept),
      }),
    )
    .filter(kept)
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
