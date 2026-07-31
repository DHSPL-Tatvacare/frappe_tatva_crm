// ONE rule for a task's due-relation bucket + its callout colour. Derived against *now* (never stored —
// "overdue" moves with the clock), keyed off due_date/due_iso + status. Shared by the per-lead Tasks
// timeline (bucket labels), the global Tasks list (badge / grouping) and the Kanban card marker — change
// the rule or a colour here and every surface moves together. Colours: Overdue red, Due Today / Upcoming
// amber, the rest none (only the two callouts, nothing else, to stay quiet).
// These five buckets ARE the server's `due_state` declaration (tatva_connect/list_engine/fields.py) in the
// same order; a task must never read as one thing in the list column and another on its card.
import { dayjsLocal } from 'frappe-ui'

// Today as the user reads it, through the app's own date reader. `new Date().toISOString()` is the UTC date, so between midnight and 05:30 IST it named yesterday and every overdue task lost a day.
const todayLocal = () => dayjsLocal().format('YYYY-MM-DD')

// Tomorrow at 00:00, local. The day boundary is exclusive: an inclusive `23:59:59` end reads differently in SQL than in JS, and the server rule is written half-open for exactly that reason.
const tomorrowStartLocal = () => dayjsLocal().add(1, 'day').startOf('day')

// `value` is the server's bucket name, untranslated — it is what arrives in a `due_state` cell, so the
// table maps on it and never on `label`, which a translated site would change out from under the lookup.
// `color` is the quiet two-colour callout the lead rail uses; `badge` is the table's frappe-ui Badge theme
// (gray|blue|green|orange|red are the only five it has). One declaration, three presentations.
// `calendar` is the frappe-ui palette, which has NO red — Overdue reads amber there. OPEN DECISION.
export const DUE_BUCKETS = [
  { key: 'overdue', value: 'Overdue', label: __('Overdue'), color: 'red', badge: 'red', calendar: 'amber' },
  { key: 'today', value: 'Due Today', label: __('Due Today'), color: 'amber', badge: 'orange', calendar: 'orange' },
  { key: 'upcoming', value: 'Upcoming', label: __('Upcoming'), color: 'amber', badge: 'blue', calendar: 'blue' },
  { key: 'none', value: 'No Due Date', label: __('No Due Date'), color: null, badge: 'gray', calendar: 'cyan' },
  { key: 'history', value: 'History', label: __('History'), color: null, badge: 'green', calendar: 'green' },
]

// A `due_state` cell value -> its Badge theme. Unknown values read gray rather than rendering unstyled.
export const dueStateTheme = (value) =>
  DUE_BUCKETS.find((b) => b.value === value)?.badge || 'gray'

// A cell value -> its Calendar palette name; the ONE place those colours are decided. Unknown reads blue.
export const dueStateCalendarColor = (value) =>
  DUE_BUCKETS.find((b) => b.value === value)?.calendar || 'blue'

// The label a cell should print for a server value, so a translated site still reads in the user's language.
export const dueStateLabel = (value) =>
  DUE_BUCKETS.find((b) => b.value === value)?.label || value

const COLOR_OF = Object.fromEntries(DUE_BUCKETS.map((b) => [b.key, b.color]))

// A task → its bucket key. Accepts a board row (`due_iso`) or an activity row (`due_date`); either is a
// datetime, and it is compared AS a datetime. No due date is its OWN bucket, not a kind of upcoming —
// an unscheduled task is a state a rep acts on. Done/Canceled ⇒ History.
// Comparing dates was a real defect: a task due 09:00 read "Due Today" until midnight while the server
// (team_charts.py, and now the due_state declaration) already counted it overdue, so the badge and the
// list contradicted each other. The server rule this mirrors is tatva_connect/list_engine/fields.py.
export function dueBucket(task) {
  if (task.status === 'Done' || task.status === 'Canceled') return 'history'
  const raw = task.due_iso || task.due_date
  if (!raw) return 'none'
  const due = dayjsLocal(raw)
  if (due.isBefore(dayjsLocal())) return 'overdue'
  if (due.isBefore(tomorrowStartLocal())) return 'today'
  return 'upcoming'
}

// The callout colour for a task ('red' | 'amber' | null) — the two-colour quick signal, null = no callout.
export const dueColor = (task) => COLOR_OF[dueBucket(task)] || null

// Tailwind text class for a bucket colour, for a label/date that should read the callout (tokens only).
export function dueTextClass(color) {
  return color === 'red'
    ? 'text-ink-red-4'
    : color === 'amber'
      ? 'text-ink-amber-3'
      : ''
}

// frappe-ui's Badge themes are gray|blue|green|orange|red — `amber` is a CALLOUT colour in this file, not
// a Badge theme, and passing it renders an unstyled pill. The two-colour signal maps once, here.
const BADGE_THEME = { red: 'red', amber: 'orange' }

const DAY_MS = 86400000
const startOfDay = (value) => new Date(String(value).slice(0, 10))

// A task → the ONE status pill its card wears, or null when it has nothing to say. Same rule as the
// bucket above, so a card's badge and the heading it sits under can never disagree. An OPEN task is the
// case that had no badge at all before, which is why an overdue one looked identical to an upcoming one.
export function dueBadge(task) {
  const bucket = dueBucket(task)
  if (bucket !== 'overdue' && bucket !== 'today') return null
  if (bucket === 'today')
    return { label: __('Due today'), theme: BADGE_THEME.amber }
  const days = Math.round(
    (startOfDay(todayLocal()) - startOfDay(task.due_iso || task.due_date)) /
      DAY_MS,
  )
  // A task due earlier TODAY is overdue by zero days; it reads as plain Overdue, never "by 0 days".
  return {
    label:
      days < 1
        ? __('Overdue')
        : days === 1
          ? __('Overdue by 1 day')
          : __('Overdue by {0} days', [days]),
    theme: BADGE_THEME.red,
  }
}
