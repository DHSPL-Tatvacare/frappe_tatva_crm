// Purpose: lock the ONE bridge between Filter.vue's flat emit dict and the Smart View composer's
// predicate tree. filtersToPredicate maps each fieldname -> a leaf {field, operator, value}; the
// inverse seeds the editor when re-opening a saved view. If these two drift apart, a saved filter
// would render differently than it was authored — these tests pin every leaf operator + the drops.
import { filtersToPredicate } from '@/tatva/smartViewPredicate'

describe('filtersToPredicate', () => {
  it('a bare scalar value becomes an = leaf', () => {
    expect(filtersToPredicate({ status: 'Done' })).toEqual({
      op: 'and',
      conditions: [{ field: 'status', operator: '=', value: 'Done' }],
    })
  })

  it('a boolean maps to 1 / 0 (Check field equals)', () => {
    expect(filtersToPredicate({ active: true })).toEqual({
      op: 'and',
      conditions: [{ field: 'active', operator: '=', value: 1 }],
    })
    expect(filtersToPredicate({ active: false })).toEqual({
      op: 'and',
      conditions: [{ field: 'active', operator: '=', value: 0 }],
    })
  })

  it('LIKE / NOT LIKE tokens lower-case to like / not like', () => {
    expect(filtersToPredicate({ title: ['LIKE', 'x'] }).conditions[0]).toEqual({
      field: 'title',
      operator: 'like',
      value: 'x',
    })
    expect(filtersToPredicate({ title: ['NOT LIKE', 'x'] }).conditions[0]).toEqual({
      field: 'title',
      operator: 'not like',
      value: 'x',
    })
  })

  it('in passes the array value through', () => {
    expect(filtersToPredicate({ priority: ['in', ['Low', 'High']] }).conditions[0]).toEqual({
      field: 'priority',
      operator: 'in',
      value: ['Low', 'High'],
    })
  })

  it("['is','set'] / ['is','not set'] become presence ops with null value", () => {
    expect(filtersToPredicate({ owner: ['is', 'set'] }).conditions[0]).toEqual({
      field: 'owner',
      operator: 'is set',
      value: null,
    })
    expect(filtersToPredicate({ owner: ['is', 'not set'] }).conditions[0]).toEqual({
      field: 'owner',
      operator: 'is not set',
      value: null,
    })
  })

  it('between / timespan pass through to the composer (date fields)', () => {
    // between / timespan now map 1:1 to composer operators -> the field is kept, not dropped.
    expect(filtersToPredicate({ created: ['between', [1, 2]] })).toEqual({
      op: 'and',
      conditions: [{ field: 'created', operator: 'between', value: [1, 2] }],
    })
    expect(filtersToPredicate({ created: ['timespan', 'last week'] })).toEqual({
      op: 'and',
      conditions: [{ field: 'created', operator: 'timespan', value: 'last week' }],
    })
    // both fields survive alongside a plain equality sibling.
    expect(
      filtersToPredicate({ created: ['between', [1, 2]], status: 'Open' }),
    ).toEqual({
      op: 'and',
      conditions: [
        { field: 'created', operator: 'between', value: [1, 2] },
        { field: 'status', operator: '=', value: 'Open' },
      ],
    })
  })

  it('an empty / null / {} dict returns null', () => {
    expect(filtersToPredicate(null)).toBe(null)
    expect(filtersToPredicate(undefined)).toBe(null)
    expect(filtersToPredicate({})).toBe(null)
  })

  it('multiple keys collapse into one flat AND group', () => {
    expect(
      filtersToPredicate({ status: 'Open', priority: ['in', ['High']], owner: ['is', 'set'] }),
    ).toEqual({
      op: 'and',
      conditions: [
        { field: 'status', operator: '=', value: 'Open' },
        { field: 'priority', operator: 'in', value: ['High'] },
        { field: 'owner', operator: 'is set', value: null },
      ],
    })
  })
})

// `predicateToFilters` is gone on purpose — the bridge runs ONE direction (smartViewPredicate.js:14),
// so the suite that exercised the reverse went with it rather than describing a function nobody ships.
