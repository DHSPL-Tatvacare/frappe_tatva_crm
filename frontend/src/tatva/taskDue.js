// ONE rule for a task's due-relation bucket + its callout colour. Derived against *now* (never stored —
// "overdue" moves with the clock), keyed off due_date/due_iso + status. Shared by the per-lead Tasks
// timeline (bucket labels) and the Kanban card marker — change the rule or a colour here and both move
// together. Colours: Overdue red, Due Today / Upcoming amber, the rest none (only the two callouts).
//
// THIS FILE DOES NOT DRESS A DERIVED FIELD. A derived column, card badge or group header takes its label
// and colour from the server's own declaration, through `tatva/derivedField.js` — this map once answered
// for those too, which meant a SECOND derived field would have been labelled and coloured by the first
// one's table. What is left here is the CLIENT-SIDE rule, for the rails that compute the bucket in the
// browser because they never asked the server for it. The order matches the shipped declaration.
import { dayjsLocal } from 'frappe-ui'

// Today as the user reads it, through the app's own date reader. `new Date().toISOString()` is the UTC date, so between midnight and 05:30 IST it named yesterday and every overdue task lost a day.
const todayLocal = () => dayjsLocal().format('YYYY-MM-DD')

// Tomorrow at 00:00, local. The day boundary is exclusive: an inclusive `23:59:59` end reads differently in SQL than in JS, and the server rule is written half-open for exactly that reason.
const tomorrowStartLocal = () => dayjsLocal().add(1, 'day').startOf('day')

// `value` is the server's bucket name, untranslated — it is what arrives in a `due_state` cell, so the
// table maps on it and never on `label`, which a translated site would change out from under the lookup.
// `color` is the lead rail's own two-colour callout. Badge and calendar colours are NOT here — they are the declaration's, on the server.
export const DUE_BUCKETS = [
  { key: 'overdue', value: 'Overdue', label: __('Overdue'), color: 'red' },
  { key: 'today', value: 'Due Today', label: __('Due Today'), color: 'amber' },
  { key: 'upcoming', value: 'Upcoming', label: __('Upcoming'), color: 'amber' },
  { key: 'none', value: 'No Due Date', label: __('No Due Date'), color: null },
  { key: 'history', value: 'History', label: __('History'), color: null },
]

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
