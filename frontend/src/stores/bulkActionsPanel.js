import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { computed, ref } from 'vue'

export const visible = ref(false)

// TATVA: the count is the server's when the socket has spoken, and derived from the rows only until it
// has — the same shape `stores/notifications.js` uses for `unread`. Every bulk event carries `running`,
// so the badge moves without waiting for a refetch, and a panel that is closed never fetches at all.
const serverRunning = ref(null)

export function setServerRunning(count) {
  serverRunning.value = Number.isFinite(count) ? count : null
}

const bulkJobs = createResource({
  url: 'tatva_connect.bulk_actions.mine',
  initialData: [],
  auto: true,
  // A fetch hands authority back to the rows, so a socket count cannot go stale and sit there — the
  // same `onSuccess: () => setServerUnread(null)` the notification tray uses.
  onSuccess: () => setServerRunning(null),
})

const exportJobs = createResource({
  url: 'tatva_connect.exports.mine',
  initialData: [],
  auto: true,
})

const ACTION_VERBS = {
  Assign: 'Assign',
  'Clear Assignment': 'Clear Assignment',
  'Bulk Edit': 'Bulk Edit',
  'Bulk Delete': 'Bulk Delete',
}

function normalizeBulk(j) {
  return {
    kind: 'bulk',
    job: j.job,
    title: `${ACTION_VERBS[j.action] || j.action} · ${j.total} record${j.total === 1 ? '' : 's'}`,
    status: j.status,
    creation: j.creation,
    total: j.total,
    succeeded: j.succeeded,
    failed: j.failed,
    failed_names: j.failed_names ?? null,
    rows: null,
    truncated: null,
    file_url: null,
    file_name: null,
    error: j.error ?? null,
  }
}

function normalizeExport(j) {
  return {
    kind: 'export',
    job: j.job,
    title: `Export · ${j.source === 'Smart View' ? j.reference : j.reference || 'List'}`,
    status: j.status,
    creation: j.creation,
    total: null,
    succeeded: null,
    failed: null,
    failed_names: null,
    rows: j.rows,
    truncated: j.truncated,
    file_url: j.file_url ?? null,
    file_name: j.file_name ?? null,
    error: j.error ?? null,
  }
}

export const jobs = computed(() => {
  const bulk = (bulkJobs.data || []).map(normalizeBulk)
  const exportd = (exportJobs.data || []).map(normalizeExport)
  return [...bulk, ...exportd].sort((a, b) => new Date(b.creation) - new Date(a.creation))
})

export const runningCount = computed(() => {
  if (serverRunning.value !== null) return serverRunning.value
  return jobs.value.filter((j) => j.status === 'Queued' || j.status === 'Started').length
})

// TATVA: a job announces itself at BIRTH, not only when it finishes. Listening to ready/failed alone
// left a queued job invisible for the whole window somebody is watching the panel — it appeared only
// once a page refresh re-ran `mine`. Same events, one list, spelled here so the two panels cannot drift.
const EVENTS = [
  'crm_bulk_queued',
  'crm_bulk_started',
  'crm_bulk_ready',
  'crm_bulk_failed',
  'crm_export_ready',
  'crm_export_progress',
  'crm_export_failed',
]

// The payload moves the badge at once; the LIST is refetched only while the panel is on screen, which
// is the cost the notification tray already declines to pay (`if (visible.value && arrived)`).
function onJobEvent(event) {
  setServerRunning(event?.running)
  if (visible.value) reloadJobs()
}

function reloadJobs() {
  bulkJobs.reload()
  exportJobs.reload()
}

// Both panels bind the same handler to the same events; the desktop tray flips `visible` itself, and
// the mobile page sets it on mount because there it IS the panel.
export function subscribeToJobEvents(socket) {
  EVENTS.forEach((e) => socket?.on(e, onJobEvent))
}

export function unsubscribeFromJobEvents(socket) {
  EVENTS.forEach((e) => socket?.off(e, onJobEvent))
}

export const bulkActionsPanelStore = defineStore('crm-bulk-actions-panel', () => {
  function toggle() {
    visible.value = !visible.value
  }

  const reload = reloadJobs

  return { jobs, runningCount, toggle, reload, setServerRunning }
})
