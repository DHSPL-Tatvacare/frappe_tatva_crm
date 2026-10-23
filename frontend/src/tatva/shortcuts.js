import { isMac } from '@/composables/settings'

// The ONE table of app shortcuts, Helpdesk's keys: each binding's match beside how ⌘/ prints it, so the list cannot drift from the keys.
const meta = isMac ? '⌘' : 'Ctrl'
const shift = 'Shift'

const plain = (key) => (e) => e.key.toLowerCase() === key && !e.metaKey && !e.ctrlKey && !e.altKey
// A Mac keeps '.' under ⌘⇧ while other platforms report '>', as Helpdesk's normalizeKey notes.
const withMeta = (keys, withShift = false) => (e) =>
  (e.metaKey || e.ctrlKey) && e.shiftKey === withShift && keys.includes(e.key.toLowerCase())

// A reka Dialog or Popover makes the body inert and frappe's isDialogOpen() misses it, so a shortcut asks the DOM for open modal content.
export const anyModalOpen = () => !!document.querySelector('[role="dialog"][data-state="open"]')

// Labels are translated where they render, so this module never needs __ at import time.
export const SHORTCUTS = {
  search: { keys: [meta, 'K'], label: 'Open search', match: withMeta(['k']) },
  settings: { keys: [meta, ','], label: 'Open settings', match: withMeta([',']) },
  shortcuts: { keys: [meta, '/'], label: 'Show keyboard shortcuts', match: withMeta(['/']) },
  help: { keys: [meta, 'H'], label: 'Open help', match: withMeta(['h']) },
  stage: { keys: ['S'], label: 'Change stage', match: plain('s') },
  assign: { keys: ['A'], label: 'Assign lead', match: plain('a') },
  copyId: { keys: [meta, '.'], label: 'Copy lead ID', match: withMeta(['.']) },
  copyUrl: { keys: [meta, shift, '.'], label: 'Copy lead URL', match: withMeta(['.', '>'], true) },
  nextLead: { keys: [shift, '.'], label: 'Next lead', match: plain('>') },
  previousLead: { keys: [shift, ','], label: 'Previous lead', match: plain('<') },
}
