// TATVA: the ONE decision behind filter-on-cell-click, extracted so it is testable without a browser.
//
// A list row is a real anchor (Leads' `getRowRoute`) or carries an `onRowClick` modal, so a plain click
// belongs to the ROW: the user expects the record. Filtering is still there, it just has to be asked for
// — Alt-click. Cmd/Ctrl/Shift are the browser's OWN new-tab and new-window gestures on an anchor, and
// intercepting any of them would take away the thing that makes the row worth being a link.
// A Datetime/Time cell stays unfilterable, as it was before Alt-click: its value is an exact instant, so
// a filter on it can only ever return the one row that was clicked. Moving filtering to Alt-click was
// never meant to widen WHAT may be filtered.
const UNFILTERABLE_TYPES = ['Datetime', 'Time']

export function shouldFilterOnCellClick(event, column) {
  if (!event?.altKey) return false
  if (UNFILTERABLE_TYPES.includes(column?.type)) return false
  return !event.ctrlKey && !event.metaKey && !event.shiftKey
}
