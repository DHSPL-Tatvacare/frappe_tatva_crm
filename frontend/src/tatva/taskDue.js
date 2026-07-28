// ONE rule for a task's due-relation bucket + its callout colour. Derived against *today* (never stored —
// "overdue" moves with the date), keyed off due_date/due_iso + status. Shared by the per-lead Tasks
// timeline (bucket labels), the global Tasks list (badge / grouping) and the Kanban card marker — change
// the rule or a colour here and every surface moves together. Colours: Overdue red, Due Today / Upcoming
// amber, History none (only the two callouts, nothing else, to stay quiet).
import { dayjsLocal } from 'frappe-ui'

// Today as the user reads it, through the app's own date reader. `new Date().toISOString()` is the UTC date, so between midnight and 05:30 IST it named yesterday and every overdue task lost a day.
const todayLocal = () => dayjsLocal().format('YYYY-MM-DD')

export const DUE_BUCKETS = [
  { key: 'overdue', label: __('Overdue'), color: 'red' },
  { key: 'today', label: __('Due Today'), color: 'amber' },
  { key: 'upcoming', label: __('Upcoming'), color: 'amber' },
  { key: 'history', label: __('History'), color: null },
]

const COLOR_OF = Object.fromEntries(DUE_BUCKETS.map((b) => [b.key, b.color]))

// A task → its bucket key. Accepts a board row (`due_iso`) or an activity row (`due_date`); either is a
// datetime we compare on its date. No due date ⇒ Upcoming; Done/Canceled ⇒ History.
export function dueBucket(task) {
  if (task.status === 'Done' || task.status === 'Canceled') return 'history'
  const raw = task.due_iso || task.due_date
  if (!raw) return 'upcoming'
  const today = todayLocal()
  const due = String(raw).slice(0, 10)
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return 'upcoming'
}

// The callout colour for a task ('red' | 'amber' | null) — the two-colour quick signal, null = no callout.
export const dueColor = (task) => COLOR_OF[dueBucket(task)] || null

// Tailwind text class for a bucket colour, for a label/date that should read the callout (tokens only).
export function dueTextClass(color) {
  return color === 'red' ? 'text-ink-red-4' : color === 'amber' ? 'text-ink-amber-3' : ''
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
  if (bucket === 'history' || bucket === 'upcoming') return null
  if (bucket === 'today') return { label: __('Due today'), theme: BADGE_THEME.amber }
  const days = Math.round(
    (startOfDay(todayLocal()) - startOfDay(task.due_iso || task.due_date)) / DAY_MS,
  )
  return {
    label: days === 1 ? __('Overdue by 1 day') : __('Overdue by {0} days', [days]),
    theme: BADGE_THEME.red,
  }
}
