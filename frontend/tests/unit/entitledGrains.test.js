// Unit tests for the grain key helpers (the new entitlement-driven Create-Lead logic).
// useEntitledGrains imports createResource from frappe-ui at module load; stub it so we can test the
// pure helpers without pulling the data layer. The single-vs-manager rule (grainLocked) is the
// composable's reactive concern and is exercised via component/integration tests, not here.
import { vi } from 'vitest'

vi.mock('frappe-ui', () => ({ createResource: () => ({ data: null, loading: false }) }))

import { axesFromKey, keyFromAxes } from '@/tatva/useEntitledGrains'

describe('useEntitledGrains key helpers', () => {
  it('keyFromAxes joins the three axes with ::', () => {
    expect(
      keyFromAxes({ vertical: 'ZZ Care', group: 'ZZ Group', program: 'ZZ Program' }),
    ).toBe('ZZ Care::ZZ Group::ZZ Program')
  })

  it('keyFromAxes blanks missing axes (and tolerates null)', () => {
    expect(keyFromAxes({ vertical: 'ZZ Care', group: 'ZZ Group' })).toBe('ZZ Care::ZZ Group::')
    expect(keyFromAxes({})).toBe('::::') // three empty axes joined by '::' (round-trips to all-blank)
    expect(keyFromAxes(null)).toBe('::::')
  })

  it('axesFromKey splits the key back into axes', () => {
    expect(axesFromKey('ZZ Care::ZZ Group::ZZ Program')).toEqual({
      vertical: 'ZZ Care',
      group: 'ZZ Group',
      program: 'ZZ Program',
    })
  })

  it('axesFromKey fills missing/blank axes with empty strings (and tolerates null)', () => {
    expect(axesFromKey('ZZ Care::ZZ Group::')).toEqual({
      vertical: 'ZZ Care',
      group: 'ZZ Group',
      program: '',
    })
    expect(axesFromKey('')).toEqual({ vertical: '', group: '', program: '' })
    expect(axesFromKey(null)).toEqual({ vertical: '', group: '', program: '' })
  })

  it('round-trips a full grain: axes -> key -> axes', () => {
    const g = { vertical: 'TatvaPractice', group: 'India', program: 'FieldSales' }
    expect(axesFromKey(keyFromAxes(g))).toEqual(g)
  })

  it('round-trips a partial grain (blank program is a legitimate wildcard)', () => {
    const g = { vertical: 'TatvaPractice', group: 'India', program: '' }
    expect(axesFromKey(keyFromAxes(g))).toEqual(g)
  })
})
