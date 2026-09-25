// A child row the builder's save leaves out is DELETED, so both transforms must hand back exactly the rows they were given.
import { bindLayout, flattenLayout } from '@/tatva/forms/layoutTree'
import { toCards, flattenCards } from '@/tatva/forms/ruleCards'

const row = (name, fieldtype = 'Data') => ({ name, fieldname: name, fieldtype })

// Shaped as `layout_tree` walks it: an implicit column, a Column Break, an EMPTY Section Break, then a Tab Break.
const schema = [
  row('a'),
  row('b'),
  row('col', 'Column Break'),
  row('c'),
  row('empty_sec', 'Section Break'),
  row('sec', 'Section Break'),
  row('d'),
  row('tab', 'Tab Break'),
  row('e'),
]
const layout = [
  {
    row: null,
    sections: [
      { row: null, columns: [{ row: null, fields: ['a', 'b'] }, { row: 'col', fields: ['c'] }] },
      { row: 'empty_sec', columns: [{ row: null, fields: [] }] },
      { row: 'sec', columns: [{ row: null, fields: ['d'] }] },
    ],
  },
  { row: 'tab', sections: [{ row: null, columns: [{ row: null, fields: ['e'] }] }] },
]

describe('layoutTree', () => {
  it('writes back every row once, in declaration order, empty containers included', () => {
    const rows = flattenLayout(bindLayout(layout, schema))
    expect(rows.map((r) => r.name)).toEqual(schema.map((r) => r.name))
    expect(rows.map((r) => r.idx)).toEqual(schema.map((_, i) => i + 1))
  })

  it('writes a moved question where the author dropped it', () => {
    const tree = bindLayout(layout, schema)
    const [a] = tree[0].sections[0].columns[0].fields.splice(0, 1)
    tree[1].sections[0].columns[0].fields.push(a)
    expect(flattenLayout(tree).map((r) => r.name)).toEqual(['b', 'col', 'c', 'empty_sec', 'sec', 'd', 'tab', 'e', 'a'])
  })
})

describe('ruleCards', () => {
  const rule = (name, rule_label, condition_value, action) => ({
    name,
    rule_label,
    condition_field: rule_label ? 'outcome' : '',
    operator: rule_label ? 'is' : '',
    condition_value,
    action,
  })
  const rules = [
    rule('r1', '', '', 'Hide'),
    rule('r2', 'Connected', 'Connected', 'Show'),
    rule('r3', 'Connected', 'Connected', 'Make Mandatory'),
    rule('r4', 'Not Connected', 'Not Connected', 'Show'),
    rule('r5', 'Connected', 'Connected', 'Hide'),
  ]

  it('groups only ADJACENT twins, and flattens back to the same rows in the same order', () => {
    const cards = toCards(rules)
    expect(cards.map((c) => c.rows.map((r) => r.name))).toEqual([['r1'], ['r2', 'r3'], ['r4'], ['r5']])
    expect(flattenCards(cards).map((r) => [r.name, r.idx])).toEqual(rules.map((r, i) => [r.name, i + 1]))
  })
})
