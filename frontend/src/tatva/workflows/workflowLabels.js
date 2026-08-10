// TATVA: how a workflow ORIENTS a reader — what it watches, on which save, and for whose business line. It lived inside WorkflowDetail.vue until the runs page needed the same line, and a second copy would have drifted the moment either was edited.
import { grainLabel } from '@/tatva/useEntitledGrains'

// A workflow stores its grain under dispatch names (`trigger_*`), so this only RENAMES the axes onto the shape the one grain labeller reads. It does not decide how a grain looks — that rule lives with the entitlement brain every other grain surface already reads, and an earlier copy here invented a slash separator the app uses nowhere.
export function workflowGrainLabel(doc) {
  return grainLabel({
    vertical: doc?.trigger_vertical,
    group: doc?.trigger_group,
    program: doc?.trigger_program,
  })
}

// What fires it: the record it watches, how it is triggered, and on which event.
export function triggerLabel(doc) {
  return [doc?.trigger_doctype, doc?.trigger_mode, doc?.trigger_event]
    .filter(Boolean)
    .join(' · ')
}

// The ONE orientation line, read by the canvas header and the runs page header. Em-dash between the two halves because each is itself middle-dot joined, and one separator doing both jobs reads as a single five-part list.
export function workflowSubtitle(doc) {
  if (!doc) return ''
  const trigger = triggerLabel(doc)
  return [trigger && __('on {0}', [trigger]), workflowGrainLabel(doc)]
    .filter(Boolean)
    .join(' — ')
}
