// Purpose: pin the shared activity-toolbar singleton + its reset, so per-tab state never bleeds across
// tab switches (search/fields/predicate/hasData cleared, model replaced with a fresh list-shaped object).
import { activityToolbar, resetActivityToolbar } from '@/tatva/activityToolbar'

describe('activityToolbar singleton + resetActivityToolbar', () => {
  beforeEach(() => {
    resetActivityToolbar()
  })

  it('restores every scalar/array default after mutation', () => {
    activityToolbar.search = 'lab'
    activityToolbar.fields = [{ fieldname: 'status' }]
    activityToolbar.predicate = { op: 'and', conditions: [] }
    activityToolbar.hasData = true

    resetActivityToolbar()

    expect(activityToolbar.search).toBe('')
    expect(activityToolbar.fields).toEqual([])
    expect(activityToolbar.predicate).toBe(null)
    expect(activityToolbar.hasData).toBe(false)
  })

  it('resets model to a fresh list-shaped object (not the mutated one)', () => {
    const mutated = activityToolbar.model
    activityToolbar.model.data.foo = 1
    activityToolbar.model.params.filters.bar = 2

    resetActivityToolbar()

    expect(activityToolbar.model).toEqual({ data: {}, params: { filters: {} } })
    expect(activityToolbar.model).not.toBe(mutated)
  })
})
