// A delay is stored as the `add_to_date` kwargs the resolver takes (`{"days": 10}`), NOT as seconds — so
// the fork's own `formatDuration` (utils/index.js:42, seconds) is the wrong reader for it and a month is
// not a fixed number of seconds anyway (registry.py:962). The only parser for this shape lived inside
// `DurationField.vue`, which is why the canvas card printed raw JSON on every Wait and every delayed
// Create Task. It is now one module both read; these assertions are what stop a second copy appearing.
import { describe, it, expect } from 'vitest'
import { parseDelay, formatDelay } from '@/tatva/workflows/delay'
import { plural } from '@/utils'

const UNITS = [
  'years',
  'months',
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
]

describe('delay — one parser, two readers', () => {
  it('reads a stored delay back as an amount and its unit', () => {
    expect(parseDelay('{"days": 10}', UNITS)).toEqual({
      amount: 10,
      unit: 'days',
    })
    expect(parseDelay('{"minutes": 1}', UNITS)).toEqual({
      amount: 1,
      unit: 'minutes',
    })
  })

  it('says what the card must show, never the JSON', () => {
    expect(formatDelay('{"days": 10}', UNITS)).toBe('10 days')
    expect(formatDelay('{"hours": 6}', UNITS)).toBe('6 hours')
  })

  it('drops the plural on a count of one', () => {
    expect(formatDelay('{"day": 1}', ['day'])).toBe('1 day')
    expect(formatDelay('{"days": 1}', UNITS)).toBe('1 day')
  })

  it('refuses to guess at anything it cannot read, so the editor falls back to the raw box', () => {
    expect(parseDelay('add_days(now(), 3)', UNITS)).toBeNull()
    expect(parseDelay('{"days": 1, "hours": 2}', UNITS)).toBeNull()
    expect(parseDelay('{"fortnights": 2}', UNITS)).toBeNull()
    expect(formatDelay('add_days(now(), 3)', UNITS)).toBe('')
  })

  it('an unset delay is not an error — it is simply nothing to show', () => {
    expect(formatDelay('', UNITS)).toBe('')
    expect(parseDelay('', UNITS)).toEqual({ amount: null, unit: 'years' })
  })
})

// The trailing `s` is ONE rule now — a card counting routes and a control naming a unit both read it, so
// "1 routes" and "1 days" cannot come back in one place while being fixed in the other.
describe('plural — one rule for the trailing s', () => {
  it('drops it on exactly one, keeps it otherwise', () => {
    expect(plural(1, 'routes')).toBe('route')
    expect(plural(3, 'routes')).toBe('routes')
    expect(plural(0, 'fields')).toBe('fields')
    expect(plural(1, 'days')).toBe('day')
  })

  it('leaves a word that is already singular alone', () => {
    expect(plural(1, 'day')).toBe('day')
  })
})
