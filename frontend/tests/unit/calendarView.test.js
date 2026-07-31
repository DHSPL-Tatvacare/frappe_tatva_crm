// The Tasks calendar's pure logic: the events it hands the component, and the datetime a clicked cell
// starts a create from. Every case here is one that renders a WRONG or MISSING event on screen, not a
// shape preference — the component silently draws nothing for a bad key.
//
// The calendar is a view type over the SAME list resource every other view renders from, and the component
// buckets events by date itself (CalendarMonthly.vue:99), caps each cell and draws its own "N more".
//
// It DOES have a window, and that reverses an earlier call. Drawing every matching record and letting the
// component pick the month is fine at three thousand and is a full-table read at a hundred thousand — the
// 1000-row backstop then quietly drew a thinner month than the truth. The component reports the range it
// is showing, so the fetch is bounded by it. That window is the second half of this file.
import { describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'

// The composable's only frappe-ui import. It declares no resource, so there is nothing else to stub.
vi.mock('frappe-ui', () => ({ dayjsLocal: (v) => (v ? dayjs(v) : dayjs()) }))
globalThis.__ = (text, args) =>
  args ? text.replace(/\{(\d+)\}/g, (_, i) => args[i]) : text

const { toCalendarEvents, cellDueDate, CALENDAR_DATE_FIELD } = await import(
  '../../src/composables/taskCalendar.js'
)
const { calendarWindow, sameWindow, PAD_DAYS } = await import(
  '../../src/composables/calendarWindow.js'
)

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

  // The colour is the DECLARATION's, carried on the descriptor the payload announced. No fieldname and no
  // colour table live here, so a second derived field colours the calendar with no edit to this file.
  const DESCRIPTOR = {
    fieldname: 'due_state',
    themes: { Overdue: 'red', 'Due Today': 'orange', History: 'green' },
  }

  it('wears the colour the declaration authored', () => {
    expect(toCalendarEvents([{ ...row, due_state: 'Due Today' }], DESCRIPTOR)[0].color).toBe('orange')
    expect(toCalendarEvents([{ ...row, due_state: 'History' }], DESCRIPTOR)[0].color).toBe('green')
  })

  // This palette has no red and no gray, so those two name their nearest rather than drawing unstyled.
  it('substitutes the two colours this component does not have', () => {
    expect(toCalendarEvents([row], DESCRIPTOR)[0].color).toBe('amber')
    expect(
      toCalendarEvents([{ ...row, due_state: 'None' }], { ...DESCRIPTOR, themes: { None: 'gray' } })[0]
        .color,
    ).toBe('cyan')
  })

  // A bucket the declaration gives no colour, and a payload with no derived field at all.
  it('falls back to a real palette name rather than drawing nothing', () => {
    expect(toCalendarEvents([{ ...row, due_state: 'Whatever' }], DESCRIPTOR)[0].color).toBe('blue')
    expect(toCalendarEvents([row], undefined)[0].color).toBe('blue')
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


describe('calendarWindow — the range the server is asked for', () => {
  const RANGE = { startDate: '2026-09-01', endDate: '2026-09-30' }

  // The three keys the engine narrows on. Without them it answers the whole table and caps at 1000.
  it('names the column the events are drawn on, so both read the same one', () => {
    expect(calendarWindow(CALENDAR_DATE_FIELD, RANGE).calendar_field).toBe('due_date')
    expect(CALENDAR_DATE_FIELD).toBe('due_date')
  })

  // The grid shows adjacent days the component's range does not name, so an unpadded window leaves them blank.
  it('pads either side so the leading and trailing cells are not empty', () => {
    const w = calendarWindow(CALENDAR_DATE_FIELD, RANGE)
    expect(w.calendar_start).toBe('2026-08-25 00:00:00')
    expect(PAD_DAYS).toBe(7)
  })

  // Half-open, like every other bound in this layer: the end is the first instant NOT drawn.
  it('ends on the day after the padded range, exclusive', () => {
    expect(calendarWindow(CALENDAR_DATE_FIELD, RANGE).calendar_end).toBe('2026-10-08 00:00:00')
  })

  // The component emits on every move; an unchanged range must not cost a request.
  it('recognises the same window so a redundant move fetches nothing', () => {
    const a = calendarWindow(CALENDAR_DATE_FIELD, RANGE)
    expect(sameWindow(a, calendarWindow(CALENDAR_DATE_FIELD, RANGE))).toBe(true)
    expect(sameWindow(a, calendarWindow(CALENDAR_DATE_FIELD, { ...RANGE, endDate: '2026-10-31' }))).toBe(
      false,
    )
  })

  // A range the component could not compute must not become a window that means "everything since 1970".
  it('answers nothing rather than a half-built window', () => {
    expect(calendarWindow(CALENDAR_DATE_FIELD, {})).toBeNull()
    expect(calendarWindow(CALENDAR_DATE_FIELD, { startDate: '2026-09-01' })).toBeNull()
    expect(calendarWindow(null, RANGE)).toBeNull()
  })
})
