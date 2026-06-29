// Unit tests for the ONE client-side predicate matcher shared by the Tasks board AND the Activities
// timeline. It mirrors the leaf operators Filter.vue -> filtersToPredicate emits; if these drift, a
// header filter would match differently across the two surfaces.
import { matchCondition, passesFilter } from '@/tatva/activityMatch'

const item = { status: 'Done', priority: 'High', title: 'Order Status Update', owner: '' }

describe('matchCondition', () => {
  it('= / != compare case-insensitively', () => {
    expect(matchCondition(item, { field: 'status', operator: '=', value: 'done' })).toBe(true)
    expect(matchCondition(item, { field: 'status', operator: '=', value: 'todo' })).toBe(false)
    expect(matchCondition(item, { field: 'status', operator: '!=', value: 'todo' })).toBe(true)
  })

  it('like / not like do substring matching', () => {
    expect(matchCondition(item, { field: 'title', operator: 'like', value: 'order' })).toBe(true)
    expect(matchCondition(item, { field: 'title', operator: 'like', value: 'refund' })).toBe(false)
    expect(matchCondition(item, { field: 'title', operator: 'not like', value: 'refund' })).toBe(true)
  })

  it('in / not in test array membership', () => {
    expect(matchCondition(item, { field: 'priority', operator: 'in', value: ['low', 'high'] })).toBe(true)
    expect(matchCondition(item, { field: 'priority', operator: 'in', value: ['low'] })).toBe(false)
    expect(matchCondition(item, { field: 'priority', operator: 'not in', value: ['low'] })).toBe(true)
  })

  it('is set / is not set check presence', () => {
    expect(matchCondition(item, { field: 'status', operator: 'is set' })).toBe(true)
    expect(matchCondition(item, { field: 'owner', operator: 'is set' })).toBe(false)
    expect(matchCondition(item, { field: 'owner', operator: 'is not set' })).toBe(true)
  })

  it('an unknown operator is permissive (returns true)', () => {
    expect(matchCondition(item, { field: 'status', operator: '???', value: 'x' })).toBe(true)
  })
})

describe('passesFilter', () => {
  it('ANDs every leaf condition', () => {
    const pred = {
      conditions: [
        { field: 'status', operator: '=', value: 'Done' },
        { field: 'priority', operator: '=', value: 'High' },
      ],
    }
    expect(passesFilter(item, pred)).toBe(true)
  })

  it('fails when any one condition fails', () => {
    const pred = {
      conditions: [
        { field: 'status', operator: '=', value: 'Done' },
        { field: 'priority', operator: '=', value: 'Low' },
      ],
    }
    expect(passesFilter(item, pred)).toBe(false)
  })

  it('an empty / missing predicate matches everything', () => {
    expect(passesFilter(item, null)).toBe(true)
    expect(passesFilter(item, { conditions: [] })).toBe(true)
  })
})
