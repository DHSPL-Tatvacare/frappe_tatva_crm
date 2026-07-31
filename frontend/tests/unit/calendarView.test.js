// The Tasks calendar's pure logic: the window it asks the server for, the events it hands the component,
// and the datetime a clicked cell starts a create from. Every case here is one that renders a WRONG or
// MISSING event on screen, not a shape preference — the component silently draws nothing for a bad key.
import { describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'

// The composable's only frappe-ui imports. `createResource` is stubbed to the shape the module reads at
// import time (`.loading`, `.submit`); nothing here calls the network — these are the pure exports.
vi.mock('frappe-ui', () => ({
  dayjsLocal: (v) => (v ? dayjs(v) : dayjs()),
  createResource: () => ({ loading: false, submit: vi.fn() }),
}))
globalThis.__ = (text, args) =>
  args ? text.replace(/\{(\d+)\}/g, (_, i) => args[i]) : text

const {
  rangeParams,
  toCalendarEvents,
  cellDueDate,
  CALENDAR_ROWS,
  CALENDAR_ROW_CAP,
  RANGE_PAD_DAYS,
} = await import('../../src/composables/taskCalendar.js')

const range = { view: 'Month', startDate: '2026-09-01', endDate: '2026-09-30' }

describe('rangeParams — the window the server is asked for', () => {
  // The month grid paints the last days of August and the first of October. Without the pad they are
  // fetched by nothing and render as empty cells on a day the rep can see a task should be.
  it('pads the emitted range on both sides so the visible grid is covered', () => {
    const { filters } = rangeParams(range, 'rep@example.com')
    const [op, [from, to]] = filters.due_date
    expect(op).toBe('between')
    expect(from).toBe(
      `${dayjs('2026-09-01').subtract(RANGE_PAD_DAYS, 'day').format('YYYY-MM-DD')} 00:00:00`,
    )
    expect(to).toBe(
      `${dayjs('2026-09-30').add(RANGE_PAD_DAYS, 'day').format('YYYY-MM-DD')} 23:59:59`,
    )
  })

  // The day boundary is where off-by-one days come from: a date-only end drops everything due that day.
  it('bounds the window with explicit datetimes, not bare dates', () => {
    const [, [from, to]] = rangeParams(range, 'rep@example.com').filters.due_date
    expect(from.endsWith(' 00:00:00')).toBe(true)
    expect(to.endsWith(' 23:59:59')).toBe(true)
  })

  // One user at a time IS the reason this view is not paginated. A missing assignee filter turns a
  // bounded month into the whole team's month with no page to fall back on.
  it('narrows to exactly one assignee', () => {
    expect(rangeParams(range, 'rep@example.com').filters.assigned_to).toBe(
      'rep@example.com',
    )
  })

  // `due_state` is derived and is only projected by crm.api.doc.get_data. Asking a different endpoint,
  // or forgetting the fieldname, returns rows with the field silently absent and one colour for all.
  it('asks for due_state like any other field, from get_data', () => {
    expect(CALENDAR_ROWS).toContain('due_state')
    expect(rangeParams(range, 'rep@example.com').rows).toBe(CALENDAR_ROWS)
  })

  // There is no Load More here. The cap is the ceiling, and the sort is what makes a capped window lose
  // its tail rather than scattered days.
  it('requests the whole window up to the cap, ordered by due date', () => {
    const params = rangeParams(range, 'rep@example.com')
    expect(params.page_length).toBe(CALENDAR_ROW_CAP)
    expect(params.order_by).toBe('due_date asc')
  })

  // Sending `columns` makes get_data (doc.py:340-343) append their keys to `rows` — a second, silent
  // declaration of the field list beside CALENDAR_ROWS.
  it('sends no columns, so rows is the only field declaration', () => {
    expect(rangeParams(range, 'rep@example.com').columns).toBeUndefined()
  })
})

describe('toCalendarEvents — the shape the component actually reads', () => {
  const row = {
    name: '12345',
    title: 'Call the patient',
    due_date: '2026-09-14 15:20:00',
    due_state: 'Overdue',
  }

  // Date and time are SEPARATE keys; a single datetime string in fromDate renders nothing at all.
  it('splits the due datetime into date and time keys', () => {
    const [event] = toCalendarEvents([row])
    expect(event.fromDate).toBe('2026-09-14')
    expect(event.fromTime).toBe('15:20')
    expect(event.toDate).toBe('2026-09-14')
    expect(event.toTime).toBe('15:50')
    expect(event.id).toBe('12345')
    expect(event.title).toBe('Call the patient')
  })

  // A 23:45 task would otherwise end at 00:15 the NEXT day and paint a second, empty event there.
  it('clamps an event that would spill past midnight to its own day', () => {
    const [event] = toCalendarEvents([
      { ...row, due_date: '2026-09-14 23:45:00' },
    ])
    expect(event.toDate).toBe('2026-09-14')
    expect(event.toTime).toBe('23:59')
  })

  // The palette has SEVEN colours and no red, so Overdue cannot wear the badge's red. Naming a colour the
  // component does not have renders an unstyled event.
  it('colours from the due_state bucket, and never uses red', () => {
    expect(toCalendarEvents([row])[0].color).toBe('amber')
    expect(
      toCalendarEvents([{ ...row, due_state: 'Due Today' }])[0].color,
    ).toBe('orange')
    expect(toCalendarEvents([{ ...row, due_state: 'History' }])[0].color).toBe(
      'green',
    )
  })

  // An unrecognised bucket must still be a real palette name, or the event draws with no colour at all.
  it('falls back to a palette colour for an unknown bucket', () => {
    expect(toCalendarEvents([{ ...row, due_state: 'Whatever' }])[0].color).toBe(
      'blue',
    )
  })

  // A task with no due date has no place on a calendar; passing it through yields 'Invalid Date' cells.
  it('drops rows with no due date', () => {
    expect(toCalendarEvents([{ ...row, due_date: null }])).toHaveLength(0)
  })

  it('survives a null payload', () => {
    expect(toCalendarEvents(null)).toEqual([])
  })
})

describe('cellDueDate — what a clicked cell prefills the create form with', () => {
  // Month view hands back a Date and no time. Midnight would create a task born overdue.
  it('uses the start of the working day when the cell carries no time', () => {
    expect(cellDueDate({ date: new Date(2026, 8, 14), time: '' })).toBe(
      '2026-09-14 09:00:00',
    )
  })

  // Week and Day hand back the slot label, which is 'HH:00' only because the config asks for 24h — in
  // the component's default 12h mode it is '3 pm' and this would produce an unparseable due date.
  it('uses the clicked slot in week and day views', () => {
    expect(cellDueDate({ date: new Date(2026, 8, 14), time: '15:00' })).toBe(
      '2026-09-14 15:00:00',
    )
  })
})
