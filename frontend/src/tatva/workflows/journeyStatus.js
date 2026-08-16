// TATVA: how a journey's state READS — one theme per status word and one sentence saying where a journey is or why it stopped; it lived inside WorkflowHistory.vue until the workflow's own run list needed the same two answers, and a copy would have drifted the moment either was edited (a status red on the lead's tab and orange in the run list is two products). Every value is the backend's own word (`CRM Workflow Journey.status`) and every sentence is built from what `history._summary` already derived.

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

// A STEP's outcome as ink — the journey has a status, a step has an outcome, and they are not the same
// vocabulary. It lives here for the reason the two above do: the run card's strip and the run modal's log
// both read it, and a copy would drift the moment either was edited. Control-flow words the interpreter
// writes plus every output a verb DECLARES; anything missing reads neutral and means nothing.
const OUTCOME_INK = {
  parked: 'text-ink-amber-3',
  failed: 'text-ink-red-4',
  resumed: 'text-ink-blue-3',
  nobody: 'text-ink-amber-3',
}

export function outcomeInk(outcome) {
  return OUTCOME_INK[outcome] || 'text-ink-gray-5'
}
