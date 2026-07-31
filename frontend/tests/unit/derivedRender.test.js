// The three surfaces the CLIENT owns for a derived field, and what each one must NOT do.
//
//   * the quick-filter settings menu is built from doctype META, which has never heard of a derived field
//   * Export builds a URL to `frappe.desk.reportview.export_query`, which is outside the engine entirely —
//     it threw on the name in `fields`/`order_by` and ignored the filter, so the rep silently got the
//     wrong rows. The translation is the SERVER's; this file proves the client only spends the answer.
//   * a cell branched on the `due_state` FIELDNAME, so a derived field on any other doctype rendered
//     unstyled beside a badge-styled column.
//
// Every one branches on the server's own `is_derived` stamp and nothing else — that, and not `due_state`,
// is what these tests pin. Each also carries the native-untouched case: with no derived descriptor in play
// the answer is the caller's own, unchanged.
import { describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'

vi.mock('frappe-ui', () => ({ dayjsLocal: (v) => (v ? dayjs(v) : dayjs()) }))
globalThis.__ = (text, args) =>
  args ? text.replace(/\{(\d+)\}/g, (_, i) => args[i]) : text

const { withDerivedOptions, exportQueryUrl, derivedBadge } = await import(
  '../../src/tatva/derivedField.js'
)

// The shape `tatva_connect.api.task_lenses.get_column_fields` answers: real columns beside a derived one.
const LENS = [
  { fieldname: 'status', name: 'status', value: 'status', label: 'Status', fieldtype: 'Select' },
  {
    fieldname: 'due_state',
    name: 'due_state',
    value: 'due_state',
    label: 'Task Status',
    fieldtype: 'Select',
    options: 'Overdue\nDue Today\nUpcoming\nNo Due Date\nHistory',
    // The colours the DECLARATION authored; the browser holds no bucket-to-colour table any more.
    themes: { Overdue: 'red', 'Due Today': 'orange', Upcoming: 'blue', 'No Due Date': 'gray', History: 'green' },
    is_derived: 1,
  },
]

// Exactly what ViewControls' quickFilterOptions builds out of doctype meta before the union.
const META_OPTIONS = [
  { label: 'Status', value: 'status', fieldtype: 'Select' },
  { label: 'Priority', value: 'priority', fieldtype: 'Select' },
]

describe('the quick-filter menu can offer a derived field', () => {
  it('offers it in the shape the menu already builds', () => {
    expect(withDerivedOptions(META_OPTIONS, LENS)).toEqual([
      ...META_OPTIONS,
      { label: 'Task Status', value: 'due_state', fieldtype: 'Select' },
    ])
  })

  it('leaves the list untouched for a doctype that declares none', () => {
    const real = LENS.filter((f) => !f.is_derived)
    expect(withDerivedOptions(META_OPTIONS, real)).toBe(META_OPTIONS)
    expect(withDerivedOptions(META_OPTIONS, [])).toBe(META_OPTIONS)
    expect(withDerivedOptions(META_OPTIONS, undefined)).toBe(META_OPTIONS)
  })

  it('does not offer a field the rep has already added, or one meta already carried', () => {
    expect(withDerivedOptions(META_OPTIONS, LENS, ['due_state'])).toBe(META_OPTIONS)
    const already = [...META_OPTIONS, { label: 'Task Status', value: 'due_state' }]
    expect(withDerivedOptions(already, LENS)).toBe(already)
  })
})

describe('export ships the rows the screen showed', () => {
  // What the server answered for a screen filtered to Overdue and sorted by the derived column: the name is
  // gone from `fields`, the filter is the declared tuples, the sort is the declaration's proxy column.
  const TRANSLATED = {
    fields: ['name', 'title', 'status'],
    filters: [
      ['CRM Task', 'status', 'not in', ['Done', 'Canceled']],
      ['CRM Task', 'due_date', 'is', 'set'],
      ['CRM Task', 'due_date', '<', '2026-07-31 10:00:00'],
    ],
    order_by: 'due_date asc',
  }

  const url = (args, extra = {}) =>
    exportQueryUrl({
      doctype: 'CRM Task',
      fileFormat: 'Excel',
      args,
      pageLength: 20,
      ...extra,
    })

  it('never puts a derived name in fields or order_by', () => {
    const built = url(TRANSLATED)
    expect(built).toContain(`fields=${JSON.stringify(TRANSLATED.fields)}`)
    expect(built).toContain('order_by=due_date asc')
    expect(built).not.toContain('due_state')
  })

  it('ships the translated tuples as the filter, not the derived bucket name', () => {
    expect(url(TRANSLATED)).toContain(
      `filters=${encodeURIComponent(JSON.stringify(TRANSLATED.filters))}`,
    )
  })

  it('is the URL it always was when the server hands the arguments back untouched', () => {
    const plain = {
      fields: ['name', 'title'],
      filters: { status: 'Todo' },
      order_by: 'modified desc',
    }
    expect(url(plain)).toBe(
      '/api/method/frappe.desk.reportview.export_query?file_format_type=Excel&title=CRM Task&doctype=CRM Task' +
        `&fields=${JSON.stringify(plain.fields)}` +
        `&filters=${encodeURIComponent(JSON.stringify(plain.filters))}` +
        '&order_by=modified desc&page_length=20&start=0&view=Report&with_comment_count=1',
    )
  })

  it('appends the rep selection only when there is one', () => {
    expect(url(TRANSLATED, { selectedItems: ['a', 'b'] })).toContain(
      '&selected_items=["a","b"]',
    )
    expect(url(TRANSLATED, { selectedItems: [] })).not.toContain('selected_items')
  })

  it('a declaration with no sort proxy leaves the export unordered rather than naming a column', () => {
    expect(url({ ...TRANSLATED, order_by: null })).toContain('&order_by=&page_length=')
  })
})

describe('a derived cell renders as a badge on every surface', () => {
  const DERIVED = LENS[1]
  const REAL = LENS[0]

  it('branches on the server stamp, not on a fieldname', () => {
    expect(derivedBadge(DERIVED, 'Overdue')).toEqual({
      label: 'Overdue',
      theme: 'red',
    })
    // The same descriptor under any other fieldname must still badge — that is the whole point of #14.
    expect(derivedBadge({ ...DERIVED, fieldname: 'sla_state' }, 'Overdue')).toEqual({
      label: 'Overdue',
      theme: 'red',
    })
  })

  it('degrades honestly for a bucket the declaration gives no colour', () => {
    expect(derivedBadge(DERIVED, 'Breached')).toEqual({
      label: 'Breached',
      theme: 'gray',
    })
  })

  // THE SECOND-BRAIN CASE: a different field, with its own buckets and colours, dressed by ITS declaration.
  it('dresses a second derived field from its own declaration, never the first one\'s', () => {
    const sla = {
      fieldname: 'sla_state',
      label: 'SLA',
      fieldtype: 'Select',
      options: 'Breached\nAt Risk\nOn Track',
      themes: { Breached: 'red', 'At Risk': 'orange', 'On Track': 'green' },
      is_derived: 1,
    }
    expect(derivedBadge(sla, 'Breached')).toEqual({ label: 'Breached', theme: 'red' })
    expect(derivedBadge(sla, 'On Track')).toEqual({ label: 'On Track', theme: 'green' })
    // And the first field's own bucket name means nothing here.
    expect(derivedBadge(sla, 'Overdue')).toEqual({ label: 'Overdue', theme: 'gray' })
  })

  // A declaration that authored no colours at all. There is no allowlist here on purpose: the token set
  // is the server's and an unwearable colour is refused at Save, so filtering again would be a second one.
  it('reads gray when the declaration names no colour, and never invents one', () => {
    const bare = { fieldname: 'x', label: 'X', is_derived: 1 }
    expect(derivedBadge(bare, 'Overdue')).toEqual({ label: 'Overdue', theme: 'gray' })
    expect(derivedBadge({ ...bare, themes: {} }, 'Overdue')).toEqual({ label: 'Overdue', theme: 'gray' })
  })

  it('passes the authored colour through rather than judging it a second time', () => {
    const bare = { fieldname: 'x', label: 'X', is_derived: 1, themes: { Overdue: 'red' } }
    expect(derivedBadge(bare, 'Overdue').theme).toBe('red')
  })

  it('says nothing for a real column or an empty cell, so native rendering runs', () => {
    expect(derivedBadge(REAL, 'Todo')).toBeNull()
    expect(derivedBadge(undefined, 'Overdue')).toBeNull()
    expect(derivedBadge(DERIVED, null)).toBeNull()
    expect(derivedBadge(DERIVED, '')).toBeNull()
  })
})
