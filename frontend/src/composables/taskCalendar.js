import { dayjsLocal } from 'frappe-ui'

// TATVA: the mappings the frappe-ui Calendar cannot do for itself. Everything else is the component's:
// it buckets events by date (CalendarMonthly.vue:99), caps each cell and draws its own "N more" into the
// day (ShowMoreCalendarEvent.vue), owns Month/Week/Day, navigation, layout and clicks.
//
// It also TELLS us which dates are on screen, and that is what bounds the fetch — see
// `composables/calendarWindow.js`. The date column below is the one the window narrows on, declared once
// here so the events and the query can never be drawn from two different columns.

// A task is an instant, not a span — drawn as a short block at its due time so week/day views can lay it
// out. The task's own `start_date` is deliberately NOT used: it can predate the due date by days.
export const EVENT_MINUTES = 30

// The column a task is placed on. The mapper reads it and the window narrows on it — one declaration.
export const CALENDAR_DATE_FIELD = 'due_date'

// A cell clicked in Month view carries no time (Calendar.vue:323 defaults it to ''), so a create started
// there needs an hour. Start of the working day, rather than midnight, which would be born overdue.
export const DEFAULT_DUE_HOUR = 9

// get_data rows -> the component's event objects. Date and time are SEPARATE keys and the date is
// 'YYYY-MM-DD', the time 'HH:mm' (Calendar.story.vue:122-141) — a single datetime string renders nothing.
// frappe-ui's Calendar palette has no red and no gray, so those two authored colours name their nearest.
const CALENDAR_SUBSTITUTE = { red: 'amber', gray: 'cyan' }

// `descriptor` is the derived field's own entry off the payload — its fieldname and its authored colours.
// The badge wears the same map, so a task cannot be red in the list and blue on the calendar, and NO
// fieldname appears here: a second derived field colours the calendar with no edit to this file.
const eventColor = (descriptor, row) => {
  const authored = descriptor?.themes?.[row[descriptor?.fieldname]]
  return CALENDAR_SUBSTITUTE[authored] || authored || 'blue'
}

export function toCalendarEvents(rows, descriptor) {
  return (rows || [])
    .filter((row) => row[CALENDAR_DATE_FIELD])
    .map((row) => {
      const from = dayjsLocal(row[CALENDAR_DATE_FIELD])
      const to = from.add(EVENT_MINUTES, 'minute')
      // A block spilling past midnight is clamped to its own day: `toDate` rolling forward paints a
      // second, empty event on the next one.
      const end = to.isSame(from, 'day') ? to : from.endOf('day')
      return {
        id: row.name,
        title: row.title || __('Untitled task'),
        fromDate: from.format('YYYY-MM-DD'),
        toDate: end.format('YYYY-MM-DD'),
        fromTime: from.format('HH:mm'),
        toTime: end.format('HH:mm'),
        color: eventColor(descriptor, row),
        isFullDay: false,
      }
    })
}

// A clicked cell -> the due datetime a Create Task should start from. Month hands back a Date with no
// time; Week and Day hand back the slot label, which is 'HH:00' because the config asks for 24h.
export function cellDueDate({ date, time }) {
  const day = dayjsLocal(date).format('YYYY-MM-DD')
  const hour = time || `${String(DEFAULT_DUE_HOUR).padStart(2, '0')}:00`
  return `${day} ${hour}:00`
}
