import { dayjsLocal } from 'frappe-ui'
import { ref } from 'vue'

// TATVA: WHICH DATES ARE ON SCREEN — the calendar's answer to paging, and the only state shared between
// the calendar body and the page's own params object.
//
// A calendar has no Load More, so before this it asked for EVERYTHING the filters matched and drew the
// month it was on. That is fine at three thousand records and is a full-table read at a hundred thousand;
// the 1000-row backstop then silently drew an emptier month than the truth. The component already tells
// us the range it is showing (it emits on every Month/Week/Day move, deduped by range), so the server is
// asked for that range and nothing else. Each move costs one narrow query instead of one enormous one.
//
// It lives here, module level, because TWO surfaces write the request: the calendar body when the rep
// moves, and the page's own params builder when a filter, sort or view type changes. One value, one
// place — constitution F1. It is deliberately NOT a filter: a filter is a chip the rep can remove, and
// the visible month is not something they should be able to delete out from under the grid.

// The component's range names only the month, but the grid shows adjacent days — so it is padded either side.
export const PAD_DAYS = 7

const activeWindow = ref(null)

export function useCalendarWindow() {
  return activeWindow
}

// The component's range -> the three request params the engine narrows on. Half-open, like every bound here.
export function calendarWindow(field, { startDate, endDate } = {}) {
  if (!field || !startDate || !endDate) return null
  const stamp = (d) => d.startOf('day').format('YYYY-MM-DD HH:mm:ss')
  return {
    calendar_field: field,
    calendar_start: stamp(dayjsLocal(startDate).subtract(PAD_DAYS, 'day')),
    calendar_end: stamp(dayjsLocal(endDate).add(PAD_DAYS + 1, 'day')),
  }
}

export function sameWindow(a, b) {
  return (
    a?.calendar_field === b?.calendar_field &&
    a?.calendar_start === b?.calendar_start &&
    a?.calendar_end === b?.calendar_end
  )
}
