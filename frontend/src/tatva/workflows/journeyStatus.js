// TATVA: how a journey's state READS — one theme per status word and one sentence saying where a journey is or why it stopped; it lived inside WorkflowHistory.vue until the workflow's own run list needed the same two answers, and a copy would have drifted the moment either was edited (a status red on the lead's tab and orange in the run list is two products). Every value is the backend's own word (`CRM Workflow Journey.status`) and every sentence is built from what `history._summary` already derived.
import { formatNumber } from '@/utils/numberFormat'

// frappe-ui Badge themes: failure red, finished green, waiting orange, in-flight blue, ended-on-purpose gray — the same semantics WorkflowNode's live ring paints on the canvas.
export const STATUS_THEME = {
  Running: 'blue',
  Parked: 'orange',
  Done: 'green',
  Failed: 'red',
  // Ended on purpose — a retired workflow or a lead that is gone. Not a fault, so not red.
  Stopped: 'gray',
}

export function statusTheme(status) {
  return STATUS_THEME[status] || 'gray'
}

// A WORKFLOW's lifecycle state as a Badge theme, read by the list and the detail page alike; Archived is ended on purpose, so gray.
const LIFECYCLE_THEME = { Draft: 'gray', Published: 'blue', Active: 'green', Suspended: 'orange', Archived: 'gray' }

export function lifecycleTheme(state) {
  return LIFECYCLE_THEME[state] || 'gray'
}

// One sentence saying why this journey is where it is, built from what the backend already derived.
export function explainJourney(journey) {
  // The reason comes off the last failed step, derived server-side, so it cannot disagree with the log.
  if (journey.status === 'Failed') {
    const at =
      journey.failure?.node_id || journey.current_node || __('an unknown step')
    return journey.failure?.detail
      ? __('Failed at {0} — {1}', [at, journey.failure.detail])
      : __('Failed at {0}.', [at])
  }
  if (journey.status === 'Done') {
    return __('Completed.')
  }
  // Read from the journey's own column: it is terminal, so "currently at n3" would name where it died.
  if (journey.status === 'Stopped') {
    return journey.stop_reason || __('Ended.')
  }
  if (journey.status === 'Parked') {
    const waiting = journey.waiting_on || {}
    if (waiting.resume_at && waiting.signal) {
      return __('Waiting for {0}, or until {1}.', [
        waiting.signal,
        waiting.resume_at,
      ])
    }
    if (waiting.resume_at) return __('Waiting until {0}.', [waiting.resume_at])
    if (waiting.signal) {
      return waiting.signal_pending
        ? __('Waiting for {0} — a signal has arrived and will be picked up.', [
            waiting.signal,
          ])
        : __('Waiting for {0} — nothing has arrived yet.', [waiting.signal])
    }
    return __('Parked with nothing to wake it.')
  }
  return __('Currently at {0}.', [
    journey.current_node || __('an unknown step'),
  ])
}

// A step's outcome has one tone, and every surface reads it here: the run log's badge and ink, and the canvas node's live ring and dot; an unknown word reads neutral.
const OUTCOME_TONE = {
  ok: 'green',
  done: 'green',
  sent: 'green',
  placed: 'green',
  queued: 'green',
  succeeded: 'green',
  assigned: 'green',
  resumed: 'green',
  parked: 'amber',
  nobody: 'amber',
  closed: 'amber',
  suppressed: 'amber',
  failed: 'red',
}

// The three traffic lights, as whole class strings so Tailwind's scanner sees each one; `badge` is a frappe-ui Badge theme, `alert` a frappe-ui Alert theme, `outline` a faulty control's frame, `border` a faulty node's card, and `pill` the solid count the canvas draws (the node chip's own `bg-current` fill, white number).
const TONES = {
  green: { ink: 'text-ink-green-3', badge: 'green', alert: 'green', ring: 'ring-2 ring-outline-green-2', outline: 'ring-1 ring-outline-green-2', border: 'border-outline-green-2', dot: 'bg-current text-ink-green-3', pill: 'bg-current text-ink-green-3 [&>*]:text-ink-white' },
  amber: { ink: 'text-ink-amber-3', badge: 'orange', alert: 'yellow', ring: 'ring-2 ring-outline-amber-2', outline: 'ring-1 ring-outline-amber-2', border: 'border-outline-amber-2', dot: 'bg-current text-ink-amber-3', pill: 'bg-current text-ink-amber-3 [&>*]:text-ink-white' },
  red: { ink: 'text-ink-red-4', badge: 'red', alert: 'red', ring: 'ring-2 ring-outline-red-3', outline: 'ring-1 ring-outline-red-3', border: 'border-outline-red-3', dot: 'bg-current text-ink-red-4', pill: 'bg-current text-ink-red-4 [&>*]:text-ink-white' },
}
const NEUTRAL = { ink: 'text-ink-gray-5', badge: 'gray', alert: 'blue', ring: '', outline: '', border: '', dot: 'bg-surface-gray-4', pill: '' }

export function outcomeTone(outcome) {
  return TONES[OUTCOME_TONE[outcome]] || NEUTRAL
}

// A journey status's sentence ink off the same tones; a status that is not the point reads muted.
const STATUS_TONE = { Failed: 'red', Parked: 'amber' }
export function statusInk(status) {
  return TONES[STATUS_TONE[status]]?.ink || 'text-ink-gray-6'
}

// An authoring problem's tone: a warning is amber, and `blocks` is the floor, so an unknown severity reads red.
export function severityTone(severity) {
  return severity === 'warns' ? TONES.amber : TONES.red
}

// A traffic light's count: compact and truncated so a big number never widens the pill (one decimal below 10K, whole thousands above), capped at 99,999 (reads 99K), and the full figure in the site's number format for hover.
const LIGHT_CAP = 99999
const compact = (digits) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: digits, roundingMode: 'trunc' })
const LIGHT_SMALL = compact(1)
const LIGHT_LARGE = compact(0)
export function lightCount(count) {
  const shown = Math.min(count, LIGHT_CAP)
  return { short: (shown < 10000 ? LIGHT_SMALL : LIGHT_LARGE).format(shown), full: formatNumber(count, null, 0) }
}

// A set of problems reads in its worst severity: red if anything blocks, amber if only warnings remain.
export function worstTone(problems) {
  return severityTone(problems.some((p) => p.severity === 'blocks') ? 'blocks' : 'warns')
}
