// Purpose: pin the ONE status→badge-theme map so the Tasks board and TaskModal stay in lock-step.
import { statusTheme } from '@/tatva/taskStatus'

describe('statusTheme', () => {
  it('maps each known status to its badge theme', () => {
    expect(statusTheme('Done')).toBe('green')
    expect(statusTheme('Canceled')).toBe('red')
    expect(statusTheme('In Progress')).toBe('blue')
    expect(statusTheme('Todo')).toBe('gray')
    expect(statusTheme('Backlog')).toBe('orange')
  })

  it('falls back to gray for an unknown status string', () => {
    expect(statusTheme('Whatever')).toBe('gray')
  })

  it('falls back to gray for nullish / empty input', () => {
    expect(statusTheme(undefined)).toBe('gray')
    expect(statusTheme(null)).toBe('gray')
    expect(statusTheme('')).toBe('gray')
  })

  it('is case-sensitive — a lowercased known key still falls back', () => {
    expect(statusTheme('done')).toBe('gray')
  })
})
