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
      keyFromAxes({ vertical: 'GoodFlip Care', group: 'Anaya', program: 'Nivolumab' }),
    ).toBe('GoodFlip Care::Anaya::Nivolumab')
  })

  it('keyFromAxes blanks missing axes (and tolerates null)', () => {
    expect(keyFromAxes({ vertical: 'GoodFlip Care', group: 'Anaya' })).toBe('GoodFlip Care::Anaya::')
    expect(keyFromAxes({})).toBe('::::') // three empty axes joined by '::' (round-trips to all-blank)
    expect(keyFromAxes(null)).toBe('::::')
  })

  it('axesFromKey splits the key back into axes', () => {
    expect(axesFromKey('GoodFlip Care::Anaya::Nivolumab')).toEqual({
      vertical: 'GoodFlip Care',
      group: 'Anaya',
      program: 'Nivolumab',
    })
  })

  it('axesFromKey fills missing/blank axes with empty strings (and tolerates null)', () => {
    expect(axesFromKey('GoodFlip Care::Anaya::')).toEqual({
      vertical: 'GoodFlip Care',
      group: 'Anaya',
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
