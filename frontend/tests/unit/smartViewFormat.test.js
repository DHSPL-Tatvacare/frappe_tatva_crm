// Purpose: pin formatCount's LeadSquared-style compaction for the Smart View count pill. 1–999 is
// passed through verbatim; >=1000 is divided into K / M with up to two decimals, trailing zeros
// trimmed by trim() (`.toFixed(2).replace(/\.?0+$/,'')`); anything non-finite renders as ''.
import { formatCount, tabIcon } from '@/tatva/smartViewFormat'

describe('formatCount', () => {
  it('returns values below 1000 as-is strings', () => {
    expect(formatCount(726)).toBe('726')
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
  })

  it('compacts thousands to K, trimming trailing zeros', () => {
    expect(formatCount(13260)).toBe('13.26K')
    expect(formatCount(33640)).toBe('33.64K')
    expect(formatCount(2000)).toBe('2K') // 2.00 -> trimmed
    expect(formatCount(1500)).toBe('1.5K') // 1.50 -> one trailing zero trimmed
    expect(formatCount(1000)).toBe('1K')
  })

  it('compacts millions to M', () => {
    expect(formatCount(1000000)).toBe('1M')
    expect(formatCount(2500000)).toBe('2.5M')
  })

  it('returns "" for non-finite / NaN / non-numeric input', () => {
    expect(formatCount(NaN)).toBe('')
    expect(formatCount(Infinity)).toBe('')
    expect(formatCount(-Infinity)).toBe('')
    expect(formatCount('abc')).toBe('')
    expect(formatCount(undefined)).toBe('')
  })
})

// SV-20: the ONE icon rule, shared by the desktop strip and the mobile sheet. RED before the pass:
// tabIcon lived only inside SmartViewTabs.vue (import fails), and the sheet showed nothing when blank.
describe('tabIcon', () => {
  it('prefers the author-stored icon', () => {
    expect(tabIcon({ icon: '📊', base_object: 'Lead' })).toBe('📊')
  })
  it('defaults by base_object when no icon is stored', () => {
    expect(tabIcon({ base_object: 'Activity' })).toBe('check-square')
    expect(tabIcon({ base_object: 'Lead' })).toBe('user')
    expect(tabIcon({ icon: '', base_object: 'Lead' })).toBe('user')
  })
  it('never returns nothing for a malformed row', () => {
    expect(tabIcon(null)).toBe('user')
    expect(tabIcon({})).toBe('user')
  })
})
