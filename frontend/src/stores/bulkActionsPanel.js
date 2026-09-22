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

// TATVA: which records a running Bulk Delete covers, so a record's own page can say so and go read-only.
// The SERVER's rows are the truth — an event only moves it sooner. A socket that never connects (or a
// page reloaded mid-delete) must still show the state, so the rows are re-asked while anything runs.
const deleting = ref(new Set())
const deleteKey = (doctype, name) => `${doctype}:${name}`
const isRunning = (j) => j?.status === 'Queued' || j?.status === 'Started'
const POLL_MS = 5000
let pollTimer = null

function keysOf(job) {
  return (job.docnames || []).map((name) => deleteKey(job.target_doctype, name))
}

function rebuildDeleting(rows) {
  deleting.value = new Set(
    (rows || [])
      .filter((j) => j.action === 'Bulk Delete' && j.target_doctype && isRunning(j))
      .flatMap(keysOf),
  )
  pollWhileRunning()
}

function trackDelete(job) {
  if (job?.action !== 'Bulk Delete' || !job?.target_doctype) return
  const next = new Set(deleting.value)
  for (const k of keysOf(job)) {
    if (isRunning(job)) next.add(k)
    else next.delete(k)
  }
  deleting.value = next
  pollWhileRunning()
}

// The rows answer for themselves: while a delete is live this asks again, and it stops when none is.
function pollWhileRunning() {
  if (deleting.value.size && !pollTimer) {
    pollTimer = setInterval(() => bulkJobs.reload(), POLL_MS)
  } else if (!deleting.value.size && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function isDeleting(doctype, name) {
  return deleting.value.has(deleteKey(doctype, name))
}

// A tab that just queued a delete does not wait for a socket to learn about its own job.
export function refreshJobs() {
  bulkJobs.reload()
}

const bulkJobs = createResource({
  url: 'tatva_connect.bulk_actions.mine',
  initialData: [],
  auto: true,
  // A fetch hands authority back to the rows, so a socket count cannot go stale and sit there — the
  // same `onSuccess: () => setServerUnread(null)` the notification tray uses.
  onSuccess: (rows) => {
    setServerRunning(null)
    rebuildDeleting(rows) // the rows are the truth, on first load and on every re-ask
  },
})

const exportJobs = createResource({
  url: 'tatva_connect.exports.mine',
  initialData: [],
  auto: true,
})

const ACTION_VERBS = {
  Assign: 'Assign',
  'Clear Assignment': 'Clear assignment',
  Reassign: 'Reassign',
  'Bulk Edit': 'Edit',
  'Bulk Delete': 'Delete',
}

// TATVA: a row says WHAT was acted on and HOW IT ENDED — a list of "Bulk Delete · 1 record" names nothing.
function subjectOf(j) {
  if (j.total === 1 && j.docnames?.length === 1) return j.docnames[0]
  return `${j.total} records`
}

function outcomeOf(j) {
  if (j.status === 'Error') return 'could not run'
  if (j.status !== 'Completed') return ''
  if (j.failed) return `${j.succeeded} done, ${j.failed} failed`
  return `${j.succeeded} done`
}

function normalizeBulk(j) {
  return {
    kind: 'bulk',
    job: j.job,
    title: `${ACTION_VERBS[j.action] || j.action} · ${subjectOf(j)}`,
    outcome: outcomeOf(j),
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
    outcome: j.rows ? `${j.rows} rows` : '', // the same one-line answer a bulk row gives
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
  trackDelete(event)
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
