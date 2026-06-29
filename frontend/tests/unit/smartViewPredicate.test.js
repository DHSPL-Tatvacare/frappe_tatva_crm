// Purpose: lock the ONE bridge between Filter.vue's flat emit dict and the Smart View composer's
// predicate tree. filtersToPredicate maps each fieldname -> a leaf {field, operator, value}; the
// inverse seeds the editor when re-opening a saved view. If these two drift apart, a saved filter
// would render differently than it was authored — these tests pin every leaf operator + the drops.
import { filtersToPredicate, predicateToFilters } from '@/tatva/smartViewPredicate'

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

  it('an unsupported token drops that field (composer cannot express it)', () => {
    // between / timespan have no composer operator -> the whole field is skipped.
    expect(filtersToPredicate({ created: ['between', [1, 2]] })).toBe(null)
    expect(filtersToPredicate({ created: ['timespan', 'last week'] })).toBe(null)
    // only the unsupported field is dropped; supported siblings survive.
    expect(
      filtersToPredicate({ created: ['between', [1, 2]], status: 'Open' }),
    ).toEqual({ op: 'and', conditions: [{ field: 'status', operator: '=', value: 'Open' }] })
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

describe('predicateToFilters', () => {
  it('is set / is not set restore the ["is", …] token shape', () => {
    expect(
      predicateToFilters({ conditions: [{ field: 'owner', operator: 'is set' }] }),
    ).toEqual({ owner: ['is', 'set'] })
    expect(
      predicateToFilters({ conditions: [{ field: 'owner', operator: 'is not set' }] }),
    ).toEqual({ owner: ['is', 'not set'] })
  })

  it('an = leaf restores a bare scalar value', () => {
    expect(
      predicateToFilters({ conditions: [{ field: 'status', operator: '=', value: 'Done' }] }),
    ).toEqual({ status: 'Done' })
  })

  it('a missing operator defaults to = (bare value)', () => {
    expect(
      predicateToFilters({ conditions: [{ field: 'status', value: 'Done' }] }),
    ).toEqual({ status: 'Done' })
  })

  it('a mapped operator restores its [TOKEN, value] pair', () => {
    expect(
      predicateToFilters({ conditions: [{ field: 'title', operator: 'like', value: 'x' }] }),
    ).toEqual({ title: ['LIKE', 'x'] })
    expect(
      predicateToFilters({ conditions: [{ field: 'age', operator: '>', value: 18 }] }),
    ).toEqual({ age: ['>', 18] })
    expect(
      predicateToFilters({ conditions: [{ field: 'p', operator: 'not in', value: ['x'] }] }),
    ).toEqual({ p: ['not in', ['x']] })
  })

  it('a condition missing .field is skipped', () => {
    expect(
      predicateToFilters({
        conditions: [{ operator: '=', value: 'x' }, { field: 'status', operator: '=', value: 'Open' }],
      }),
    ).toEqual({ status: 'Open' })
  })

  it('an unknown operator yields no entry for that field', () => {
    // not in OP_TO_TOKEN and not a presence/= op -> falls through every branch.
    expect(
      predicateToFilters({ conditions: [{ field: 'x', operator: 'between', value: [1, 2] }] }),
    ).toEqual({})
  })

  it('a null / empty tree returns {}', () => {
    expect(predicateToFilters(null)).toEqual({})
    expect(predicateToFilters(undefined)).toEqual({})
    expect(predicateToFilters({})).toEqual({})
    expect(predicateToFilters({ conditions: [] })).toEqual({})
  })
})

describe('round-trip predicateToFilters(filtersToPredicate(x))', () => {
  it('preserves representative non-boolean dicts', () => {
    const cases = [
      { status: 'Done' },
      { title: ['LIKE', 'order'] },
      { title: ['NOT LIKE', 'refund'] },
      { priority: ['in', ['Low', 'High']] },
      { owner: ['is', 'set'] },
      { owner: ['is', 'not set'] },
      { status: 'Open', priority: ['in', ['High']], owner: ['is', 'set'] },
    ]
    for (const dict of cases) {
      expect(predicateToFilters(filtersToPredicate(dict))).toEqual(dict)
    }
  })
})
