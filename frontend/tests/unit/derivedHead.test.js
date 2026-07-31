// The two client-side halves of the HEAD — a derived field authored by an operator in Desk rather than
// declared in code — and the regression each one must not cause.
//
//   * a field written in a text box brings its own COLOURS, and the renderer takes them from THERE and
//     from nowhere else. `due_state` is now such a field too — it is a seeded row, not code — so its five
//     colours arrive on its descriptor exactly as any other field's do.
//   * those five field menus are cached in IndexedDB with NO expiry, so a rep who loaded the page before
//     the field existed would never see it. The cache key carries the server's declaration version, and
//     the whole "live on Save" promise is that string changing.
//
// Neither half knows a fieldname. What is pinned here is that an operator can add a field and a colour
// without an edit to this codebase, and that `due_state` is untouched while they do.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'

vi.mock('frappe-ui', () => ({ dayjsLocal: (v) => (v ? dayjs(v) : dayjs()) }))

const { derivedBadge } = await import('../../src/tatva/derivedField.js')
const { lensCacheGeneration, LENS_CACHE_GENERATION } = await import(
  '../../src/tatva/lensCache.js'
)

// What `descriptor()` announces for the field the plan authors: buckets in order, and a theme per bucket.
const AUTHORED = {
  fieldname: 'hba1c_control',
  label: 'HbA1c Control',
  fieldtype: 'Select',
  options: 'Controlled\nBorderline\nUncontrolled',
  themes: { Controlled: 'green', Borderline: 'orange', Uncontrolled: 'red' },
  is_derived: 1,
}

// The same field with a different colour declaration, which is the only thing an operator edits.
const themed = (themes) => ({ ...AUTHORED, themes })

// `due_state` as the SEEDED ROW declares it — five buckets and the five colours it authors. It stopped
// being a code declaration at the cutover, so a descriptor without `themes` is no longer what the server
// sends for it; asserting against one pinned the browser's own colour table in place.
const DUE_STATE = {
  fieldname: 'due_state',
  label: 'Task Status',
  fieldtype: 'Select',
  options: 'Overdue\nDue Today\nUpcoming\nNo Due Date\nHistory',
  themes: {
    Overdue: 'red',
    'Due Today': 'orange',
    Upcoming: 'blue',
    'No Due Date': 'gray',
    History: 'green',
  },
  is_derived: 1,
}

describe('a bucket wears the colour its declaration gives it', () => {
  it('renders each authored bucket in its authored theme', () => {
    expect(derivedBadge(AUTHORED, 'Controlled')).toEqual({
      label: 'Controlled',
      theme: 'green',
    })
    expect(derivedBadge(AUTHORED, 'Borderline')).toEqual({
      label: 'Borderline',
      theme: 'orange',
    })
    expect(derivedBadge(AUTHORED, 'Uncontrolled')).toEqual({
      label: 'Uncontrolled',
      theme: 'red',
    })
  })

  // The precedence has to be visible, so the bucket is deliberately named after a due-state one: if the
  // map still won here, an authored colour would be silently overridden on exactly the words a rep uses.
  it('the authored theme beats the due-state map, not the other way round', () => {
    expect(derivedBadge(themed({ Overdue: 'blue' }), 'Overdue').theme).toBe(
      'blue',
    )
  })

  it('a bucket the declaration gives no theme still reads gray', () => {
    expect(derivedBadge(themed({ Controlled: 'green' }), 'Uncontrolled')).toEqual(
      { label: 'Uncontrolled', theme: 'gray' },
    )
  })
})

describe('the colour is the declaration\'s, and this file judges it not at all', () => {
  // A colour no badge can wear is refused by `CRM Derived Field.validate` at Save, against the ONE token
  // list on the server. Filtering again here would be a second list, drifting the day the first changes.
  it('passes an authored colour straight through', () => {
    expect(derivedBadge(themed({ Controlled: 'red' }), 'Controlled').theme).toBe('red')
  })

  it('a themes key that is not a map at all is simply not a theme', () => {
    for (const broken of [null, undefined, '[]', 5]) {
      expect(derivedBadge(themed(broken), 'Controlled').theme).toBe('gray')
    }
  })
})

describe('due_state renders exactly as it did before the head existed', () => {
  // The colours are unchanged; where they COME FROM is not. They are the seed's, carried on the descriptor,
  // rather than a table in the browser keyed on this one field's bucket names.
  const TODAY = [
    ['Overdue', 'red'],
    ['Due Today', 'orange'],
    ['Upcoming', 'blue'],
    ['No Due Date', 'gray'],
    ['History', 'green'],
  ]

  it('keeps all five colours and labels', () => {
    for (const [value, theme] of TODAY) {
      expect(derivedBadge(DUE_STATE, value)).toEqual({ label: value, theme })
    }
  })

  it('still says nothing for a real column or an empty cell', () => {
    expect(derivedBadge({ fieldname: 'status' }, 'Todo')).toBeNull()
    expect(derivedBadge(DUE_STATE, null)).toBeNull()
    expect(derivedBadge(DUE_STATE, '')).toBeNull()
  })
})

describe('the field menus retire when the operator authors a field', () => {
  beforeEach(() => {
    delete globalThis.derived_field_version
  })
  afterEach(() => {
    delete globalThis.derived_field_version
  })

  it('is one stable string for a site that has authored nothing', () => {
    expect(lensCacheGeneration()).toBe(lensCacheGeneration())
    expect(LENS_CACHE_GENERATION).toBe(lensCacheGeneration())
  })

  it('changes the moment the declaration version does', () => {
    globalThis.derived_field_version = '2026-07-31 10:00:00'
    const before = lensCacheGeneration()
    globalThis.derived_field_version = '2026-07-31 10:04:12'
    expect(lensCacheGeneration()).not.toBe(before)
  })

  it('is stable while the declaration version is', () => {
    globalThis.derived_field_version = '2026-07-31 10:00:00'
    const seen = lensCacheGeneration()
    expect(lensCacheGeneration()).toBe(seen)
    globalThis.derived_field_version = '2026-07-31 10:00:00'
    expect(lensCacheGeneration()).toBe(seen)
  })

  it('a site with no version reads the shape alone, as this file always did', () => {
    const bare = lensCacheGeneration()
    globalThis.derived_field_version = ''
    expect(lensCacheGeneration()).toBe(bare)
    globalThis.derived_field_version = '2026-07-31 10:00:00'
    expect(lensCacheGeneration()).toContain(bare)
    expect(lensCacheGeneration()).not.toBe(bare)
  })

  // The five call sites read the CONSTANT, not the function — a frappe-ui cache key is snapshotted once at
  // setup — so what the constant froze at module evaluation is what actually retires the caches.
  it('the constant the five resources import carries their version', async () => {
    globalThis.derived_field_version = '2026-07-31 10:04:12'
    vi.resetModules()
    const fresh = await import('../../src/tatva/lensCache.js')
    expect(fresh.LENS_CACHE_GENERATION).toBe(fresh.lensCacheGeneration())
    expect(fresh.LENS_CACHE_GENERATION).toContain('20260731100412')
  })
})
