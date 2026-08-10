import { plural } from '@/utils'

// TATVA: how a delay READS and how it is READ BACK. A delay is stored as the `add_to_date` kwargs the resolver has always taken (`{"days": 10}`) — NOT seconds — and until now only `DurationField` knew how to unpack it, so the canvas card printed the raw JSON on every Wait and every delayed Create Task. One parser, two readers.

// `{amount, unit}` when the stored value is one plain unit, else null — and null is what puts the raw box on screen in the editor; JSON is a strict subset of the expression language, so anything it cannot read is left alone rather than guessed at.
export function parseDelay(value, units = []) {
  if (!value) return { amount: null, unit: units[0] || '' }
  let read
  try {
    read = JSON.parse(value)
  } catch {
    return null
  }
  const entries = Object.entries(read || {})
  if (entries.length !== 1) return null
  const [unit, amount] = entries[0]
  if (units.length && !units.includes(unit)) return null
  if (typeof amount !== 'number') return null
  return { amount, unit }
}

// The same delay as a person reads it — `10 days`, `1 day`. The unit words are the backend's own (`add_to_date`'s parameters), so nothing here keeps a list of them; a count of one just drops the trailing plural.
export function formatDelay(value, units = []) {
  const parsed = parseDelay(value, units)
  if (!parsed || parsed.amount === null) return ''
  return `${parsed.amount} ${__(plural(parsed.amount, parsed.unit))}`
}
