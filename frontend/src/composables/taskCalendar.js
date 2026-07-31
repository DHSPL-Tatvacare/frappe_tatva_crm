import { dayjsLocal } from 'frappe-ui'
import { dueStateCalendarColor } from '@/tatva/taskDue' // TATVA: the ONE due-state presentation map

// TATVA: the two mappings the frappe-ui Calendar cannot do for itself. Everything else is the component's:
// it buckets events by date (CalendarMonthly.vue:99), owns Month/Week/Day, navigation, layout and clicks.
// So there is no window, no range, no lazy fetch — hand it the events and it places them.

// A task is an instant, not a span — drawn as a short block at its due time so week/day views can lay it
// out. The task's own `start_date` is deliberately NOT used: it can predate the due date by days.
export const EVENT_MINUTES = 30

// A cell clicked in Month view carries no time (Calendar.vue:323 defaults it to ''), so a create started
// there needs an hour. Start of the working day, rather than midnight, which would be born overdue.
export const DEFAULT_DUE_HOUR = 9

// get_data rows -> the component's event objects. Date and time are SEPARATE keys and the date is
// 'YYYY-MM-DD', the time 'HH:mm' (Calendar.story.vue:122-141) — a single datetime string renders nothing.
export function toCalendarEvents(rows) {
  return (rows || [])
    .filter((row) => row.due_date)
    .map((row) => {
      const from = dayjsLocal(row.due_date)
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
        color: dueStateCalendarColor(row.due_state),
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
