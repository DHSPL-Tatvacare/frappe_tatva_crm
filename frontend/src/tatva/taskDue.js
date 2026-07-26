// ONE rule for a task's due-relation bucket + its callout colour. Derived against *today* (never stored —
// "overdue" moves with the date), keyed off due_date/due_iso + status. Shared by the per-lead Tasks
// timeline (bucket labels), the global Tasks list (badge / grouping) and the Kanban card marker — change
// the rule or a colour here and every surface moves together. Colours: Overdue red, Due Today / Upcoming
// amber, History none (only the two callouts, nothing else, to stay quiet).
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
  const today = new Date().toISOString().slice(0, 10)
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
