// TATVA: Task Forms layout — binds `builder_doc`'s walk (the engine's own `layout_tree`) to the draft rows and writes it back; never walks rows itself.
import { getRandom } from '@/utils'

const BREAK = { tab: 'Tab Break', section: 'Section Break', column: 'Column Break' }

// A row that opens a container rather than asking anything.
export const isLayoutRow = (row) => Object.values(BREAK).includes(row.fieldtype)

// The server's tree names each row; bound, every node holds the draft row (null = implicit container) plus the `name`/`label` `FieldLayoutEditor` reads.
export function bindLayout(layout, schema) {
  const byName = new Map(schema.map((r) => [r.name, r]))
  // A name with no row would be dropped from the save, and a dropped child row is deleted — refuse instead.
  const row = (name) => {
    if (!name) return null
    if (!byName.has(name)) throw new Error(`Task Forms: layout names an unknown row ${name}`)
    return byName.get(name)
  }
  // `label` reads and writes the row itself, so a rename in the editor is the row's rename; a rowless node keeps its own.
  const node = (name, kind, children) => {
    const r = row(name)
    return {
      row: r,
      name: r ? r.name : `${kind}_${getRandom()}`,
      get label() {
        return r ? r.label || '' : this.ownLabel || ''
      },
      set label(value) {
        if (r) r.label = value
        else this.ownLabel = value
      },
      ...children,
    }
  }
  // An EMPTY implicit container writes no row and the server regrows it, so it goes — unless it is a DECLARED parent's only child.
  const kept = (parent) => (c, i, all) =>
    c.row || (c.fields || c.columns || c.sections).length || (all.length === 1 && (!parent || parent.row))
  return layout
    .map((tab) => {
      const t = node(tab.row, 'tab')
      t.sections = tab.sections
        .map((section) => {
          const s = node(section.row, 'section')
          s.columns = section.columns
            .map((column) => node(column.row, 'column', { fields: column.fields.map(row) }))
            .filter(kept(s))
          return s
        })
        .filter(kept(t))
      return t
    })
    .filter(kept(null))
}

// A container with no row writes a new break row — unless it is an unlabelled FIRST child, which the server's walk regrows as implicit.
function breakRow(node, kind, first) {
  if (node.row) return node.row
  if (first && !node.label) return null
  return { fieldtype: BREAK[kind], fieldname: node.name, label: node.label }
}

// Back to the `schema` child table in tree order, `idx` renumbered; new rows carry no `name`, as a save requires.
export function flattenLayout(tabs) {
  const rows = []
  const add = (r) => r && rows.push(r)
  tabs.forEach((tab, t) => {
    add(breakRow(tab, 'tab', t === 0))
    tab.sections.forEach((section, s) => {
      add(breakRow(section, 'section', s === 0))
      section.columns.forEach((column, c) => {
        add(breakRow(column, 'column', c === 0))
        column.fields.forEach(add)
      })
    })
  })
  return rows.map((r, i) => ({ ...r, idx: i + 1 }))
}
