// TATVA: Task Forms rules — a card is a run of ADJACENT rows sharing the rule name and both When triplets; presentation only, the rows stay the truth.

export const WHEN = [
  'rule_label',
  'condition_field',
  'operator',
  'condition_value',
  'condition_field_2',
  'operator_2',
  'condition_value_2',
]
const sameWhen = (a, b) => WHEN.every((k) => (a[k] || '') === (b[k] || ''))

// Rows to cards, never reordered: two twins that are not adjacent stay two cards.
export function toCards(rules) {
  const cards = []
  for (const row of rules) {
    const last = cards[cards.length - 1]
    if (last && sameWhen(last.rows[0], row)) last.rows.push(row)
    else cards.push({ rows: [row] })
  }
  return cards
}

// Back to the `rules` child table in card order, `idx` renumbered.
export function flattenCards(cards) {
  return cards.flatMap((card) => card.rows).map((r, i) => ({ ...r, idx: i + 1 }))
}

// Written as the Desk picker writes it (`crm_task_type.js`); read only through `builder_doc`'s `targets`.
export const joinTargets = (fieldnames) => fieldnames.join(', ')
