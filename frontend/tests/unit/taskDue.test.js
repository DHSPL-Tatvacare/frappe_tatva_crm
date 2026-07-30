// The badge rule must name the same bucket the server's `due_state` declaration names, or a rep's pill
// contradicts the column beside it. The case that matters is a task due EARLIER TODAY: comparing dates
// called it "Due Today" until midnight while the server already counted it overdue.
import { describe, expect, it, vi, afterEach } from 'vitest'
import dayjs from 'dayjs'

vi.mock('frappe-ui', () => ({ dayjsLocal: (v) => (v ? dayjs(v) : dayjs()) }))
globalThis.__ = (text, args) =>
  args ? text.replace(/\{(\d+)\}/g, (_, i) => args[i]) : text

const { dueBucket, dueBadge } = await import('../../src/tatva/taskDue.js')

const at = (offset, unit) => dayjs().add(offset, unit).format('YYYY-MM-DD HH:mm:ss')

afterEach(() => vi.useRealTimers())

describe('dueBucket mirrors the server due_state declaration', () => {
  it('a task due a minute ago is overdue', () => {
    expect(dueBucket({ status: 'Todo', due_date: at(-1, 'minute') })).toBe(
      'overdue',
    )
  })

  it('a task due EARLIER TODAY is overdue, not due today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${dayjs().format('YYYY-MM-DD')}T22:45:00`))
    const morning = `${dayjs().format('YYYY-MM-DD')} 09:00:00`
    expect(dueBucket({ status: 'Todo', due_date: morning })).toBe('overdue')
  })

  it('a task due later today is due today', () => {
    expect(dueBucket({ status: 'Todo', due_date: at(1, 'minute') })).toBe(
      dayjs().add(1, 'minute').isSame(dayjs(), 'day') ? 'today' : 'upcoming',
    )
  })

  it('a task due tomorrow is upcoming', () => {
    expect(dueBucket({ status: 'Todo', due_date: at(1, 'day') })).toBe(
      'upcoming',
    )
  })

  it('a closed task is history whatever its due date', () => {
    for (const status of ['Done', 'Canceled']) {
      expect(dueBucket({ status, due_date: at(-3, 'day') })).toBe('history')
    }
  })
})

describe('dueBadge', () => {
  it('reads plain Overdue when the task is overdue by less than a day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${dayjs().format('YYYY-MM-DD')}T22:45:00`))
    const morning = `${dayjs().format('YYYY-MM-DD')} 09:00:00`
    expect(dueBadge({ status: 'Todo', due_date: morning })).toEqual({
      label: 'Overdue',
      theme: 'red',
    })
  })

  it('counts whole days once the task is a day or more late', () => {
    expect(dueBadge({ status: 'Todo', due_date: at(-3, 'day') }).label).toBe(
      'Overdue by 3 days',
    )
  })

  it('says nothing for an upcoming or closed task', () => {
    expect(dueBadge({ status: 'Todo', due_date: at(5, 'day') })).toBeNull()
    expect(dueBadge({ status: 'Done', due_date: at(-5, 'day') })).toBeNull()
  })
})
