import { defineStore } from 'pinia'
import { call, createResource, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import router from '@/router'
import { isMobileView } from '@/composables/settings'
import { dayLabel, plural } from '@/utils'
import { createDialog } from '@/utils/dialogs'

// TATVA: the notification tray's twin (stores/notifications.js) on ONE path: read job_feed.feed on load, then apply `crm_bulk_job` events, never poll.

const EVENT = 'crm_bulk_job'
const PAGE_SIZE = 20
const LIVE = ['Queued', 'Started']

export const visible = ref(false)

// The counts are the server's: the event's first, then the feed's.
const serverCounts = ref(null)

// The page grows and the whole page is refetched — the tray's own Load more shape.
export const pageLimit = ref(PAGE_SIZE)

export const feed = createResource({
  url: 'tatva_connect.job_feed.feed',
  initialData: { items: [], running: 0, unseen: 0, has_more: false },
  makeParams: () => ({ limit: pageLimit.value }),
  onSuccess: (data) => {
    serverCounts.value = null
    // A job this tab waits on that ended while its socket was down settles here, once.
    for (const j of data.items) if (waiters.has(j.job) && !isLive(j)) settle(j)
    rebuildDeleting(data.items)
  },
})

export function loadMore() {
  pageLimit.value += PAGE_SIZE
  feed.reload()
}

const reloadSoon = useDebounceFn(() => feed.reload(), 500)

export const unreadOnly = ref(true)
export const typeFilter = ref(null)

const counts = computed(() => serverCounts.value || feed.data)
export const unseenCount = computed(() => counts.value?.unseen || 0)
export const runningCount = computed(() => counts.value?.running || 0)

export const allJobs = computed(() => feed.data?.items || [])
export const hasMore = computed(() => !!feed.data?.has_more)

export const isLive = (j) => LIVE.includes(j?.status)

// What the action dropdown groups by: a bulk job's action, or Export.
export const typeOf = (j) => (j.kind === 'export' ? 'Export' : j.action)

const scoped = computed(() =>
  unreadOnly.value ? allJobs.value.filter((j) => !j.seen) : allJobs.value,
)

export const typeCounts = computed(() => {
  const found = new Map()
  for (const j of scoped.value) found.set(typeOf(j), (found.get(typeOf(j)) || 0) + 1)
  return [...found.entries()].map(([type, count]) => ({ type, count }))
})

// A chosen type whose last row was read leaves the panel filtered to nothing, with no option left to click back.
watch(typeCounts, (found) => {
  if (typeFilter.value && !found.some((c) => c.type === typeFilter.value))
    typeFilter.value = null
})

export const visibleJobs = computed(() =>
  typeFilter.value
    ? scoped.value.filter((j) => typeOf(j) === typeFilter.value)
    : scoped.value,
)

// Same day key and reader as the tray (utils.dayLabel); the feed is newest first, so walking it keeps the groups in order.
export const groupedJobs = computed(() => {
  const groups = []
  for (const j of visibleJobs.value) {
    const key = String(j.creation).slice(0, 10)
    if (!groups.length || groups[groups.length - 1].key !== key)
      groups.push({ key, label: dayLabel(j.creation), items: [] })
    groups[groups.length - 1].items.push(j)
  }
  return groups
})

export function jobByName(name) {
  return allJobs.value.find((j) => j.job === name) || null
}

// Which records each running Bulk Delete covers (job -> keys), so a record's own page can say so and go read-only.
const deleting = ref(new Map())
const deleteKey = (doctype, name) => `${doctype}:${name}`
const keysOf = (j) => new Set((j.docnames || []).map((n) => deleteKey(j.target_doctype, n)))
const isLiveDelete = (j) => j.action === 'Bulk Delete' && isLive(j)

function rebuildDeleting(items) {
  deleting.value = new Map((items || []).filter(isLiveDelete).map((j) => [j.job, keysOf(j)]))
}

// Records a finished delete removed, so the record page's own reload of a now-missing record stays quiet.
const deleted = new Set()

function trackDelete(j) {
  if (j.action !== 'Bulk Delete') return
  const next = new Map(deleting.value)
  if (isLive(j)) next.set(j.job, keysOf(j))
  else {
    const failed = new Set((j.failed_names || []).map((f) => f.name))
    for (const key of next.get(j.job) || []) if (!failed.has(key.split(':').slice(1).join(':'))) deleted.add(key)
    next.delete(j.job)
  }
  deleting.value = next
}

// Gone, or going: a delete removes each record before the job ends, so its reload can land while the job still runs.
export function wasDeleted(doctype, name) {
  return deleted.has(deleteKey(doctype, name)) || isDeleting(doctype, name)
}

export function isDeleting(doctype, name) {
  const key = deleteKey(doctype, name)
  return [...deleting.value.values()].some((keys) => keys.has(key))
}

// What this tab asked for and wants to hear back about: job -> what to run when it ends (a list reload, a file save).
const waiters = new Map()

export function whenDone(job, onDone) {
  if (job && onDone) waiters.set(job, onDone)
}

export function openPanel() {
  if (isMobileView.value) return router.push({ name: 'BulkActions' })
  visible.value = true
  feed.reload()
}

// Built at use: `__` is wired only once the app boots.
const view = () => ({ action: { label: __('View'), onClick: openPanel } })

function announce(j) {
  if (j.aborted) return toast.info(__('Stopped · {0}', [titleOf(j)]), view())
  if (j.kind === 'export') {
    if (j.status === 'Error') toast.error(__("Couldn't prepare the export"), view())
    else toast.success(__('Export ready · {0}', [j.reference || __('List')]), view())
    return
  }
  const w = WORDS[j.action] || {}
  if (j.status === 'Error') toast.error(__("Couldn't {0} {1}", [w.verb, countOf(j.target_doctype, j.total)]), view())
  else if (j.failed) toast.warning(__('{0} {1} · {2} failed', [w.done, countOf(j.target_doctype, j.succeeded), j.failed]), view())
  else toast.success(__('{0} {1}', [w.done, countOf(j.target_doctype, j.succeeded)]), view())
}

function onJobEvent(event) {
  const rows = allJobs.value
  const known = rows.some((j) => j.job === event?.job)
  // A step carries only the counts in hand (Desk's publish_progress shape): patch the row if it is on screen, nothing else.
  if (!Number.isFinite(event?.unseen)) {
    if (known) feed.setData({ ...feed.data, items: rows.map((j) => (j.job === event.job ? { ...j, ...event } : j)) })
    return
  }
  serverCounts.value = { running: event.running, unseen: event.unseen }
  if (!event.job) {
    // Marked seen in another tab: only the dots changed.
    if (visible.value) reloadSoon()
    return
  }
  if (known) {
    feed.setData({ ...feed.data, items: rows.map((j) => (j.job === event.job ? event : j)) })
  } else if (visible.value) {
    reloadSoon()
  }
  settle(event)
}

// Jobs already announced, so a feed read and the event for the same ending never toast twice.
const settled = new Set()

// A job's new state: its records' delete marks, then, once it has ended, one toast and what this tab waited to do.
function settle(j) {
  trackDelete(j)
  if (isLive(j) || settled.has(j.job)) return
  settled.add(j.job)
  announce(j)
  const onDone = waiters.get(j.job)
  waiters.delete(j.job)
  onDone?.(j)
}

let started = false

// Once, from App.vue for a logged-in rep: the jobs outlive every screen (conventions §6), and a guest page must not ask.
export function startBulkJobs(socket) {
  if (started || !socket) return
  started = true
  feed.fetch()
  socket.on(EVENT, onJobEvent)
  // Events sent while the socket was down are gone: read the feed again on a reconnect (socket.io's own, never the first connect).
  socket.io?.on('reconnect', reloadSoon)
}

// One set of words per action, for the queued toast, the finish toast and the panel alike.
const WORDS = {
  Assign: { verb: 'assign', doing: 'Assigning', done: 'Assigned' },
  Reassign: { verb: 'reassign', doing: 'Reassigning', done: 'Reassigned' },
  'Clear Assignment': { verb: 'clear assignment on', doing: 'Clearing assignment on', done: 'Cleared assignment on' },
  'Bulk Edit': { verb: 'update', doing: 'Updating', done: 'Updated' },
  'Bulk Delete': { verb: 'delete', doing: 'Deleting', done: 'Deleted' },
}

// "1 lead", "300 leads" — the record's own noun off its doctype.
export function countOf(doctype, n) {
  const noun = String(doctype || '').replace(/^CRM /, '').toLowerCase()
  return `${n} ${__(plural(n, noun + 's'))}`
}

// The queued toast's words: "Assigning 300 leads…".
export function queuedText(action, doctype, n) {
  return __('{0} {1}…', [(WORDS[action] || {}).doing || action, countOf(doctype, n)])
}

const ACTION_VERBS = {
  Assign: 'Assign',
  'Clear Assignment': 'Clear assignment',
  Reassign: 'Reassign',
  'Bulk Edit': 'Edit',
  'Bulk Delete': 'Delete',
}

// The one name an action goes by, in a row title and in the action filter alike.
export const actionLabel = (type) => __(ACTION_VERBS[type] || type)

// "Reassign · 300 leads", "Delete · CRM-LEAD-0001", "Export · Hot Leads".
export function titleOf(j) {
  if (j.kind === 'export') return `${__('Export')} · ${j.reference || __('List')}`
  const noun = String(j.target_doctype || '').replace(/^CRM /, '').toLowerCase()
  const what = j.subject || `${j.total} ${__(noun + 's')}`
  return `${actionLabel(j.action)} · ${what}`
}

const mark_seen = createResource({
  url: 'tatva_connect.job_feed.mark_seen',
  // The rows reload once, on the counts event mark_seen publishes to every tab, this one included.
  onSuccess: () => (mark_seen.params = {}),
})

// One job when named, else every unseen one — the tray's mark_doc_as_read and mark_as_read in one.
export function markSeen(job) {
  mark_seen.params = job ? { job } : {}
  mark_seen.reload()
}

// Three emptinesses, three sentences, as the tray says them.
export const emptyState = computed(() => {
  if (typeFilter.value)
    return { title: __('Nothing here'), description: __('No {0} jobs in this view.', [__(typeFilter.value)]) }
  if (unreadOnly.value)
    return { title: __("You're all caught up"), description: __('No unread jobs. Switch to All to see earlier ones.') }
  return { title: __('No bulk actions yet'), description: __('Bulk assign, edit, delete or export jobs will show up here.') }
})

// The job open in the detail, by NAME, so the detail reads it live; a copy of the row froze at click time.
export const selectedJob = ref(null)

export const detailOpen = computed({
  get: () => !!selectedJob.value,
  set: (v) => {
    if (!v) selectedJob.value = null
  },
})

export function openJob(j) {
  if (!j.seen) markSeen(j.job)
  selectedJob.value = j.job
}

// The one Stop, for a row in the panel and for the open detail alike: ask once, then stop the job where it is.
export function confirmStop(j) {
  createDialog({
    title: __('Stop this job?'),
    message: __('It stops where it is. Records already done stay done; the rest are left as they were.'),
    actions: [
      {
        label: __('Stop'),
        variant: 'solid',
        theme: 'red',
        onClick: async (close) => {
          close()
          try {
            await call('tatva_connect.job_feed.abort', { job: j.job })
          } catch (e) {
            toast.error(e?.messages?.[0] || __('Could not stop the job.'))
          }
        },
      },
    ],
  })
}

export const bulkActionsPanelStore = defineStore('crm-bulk-actions-panel', () => {
  function toggle() {
    visible.value = !visible.value
    // Opening reads the rows again: one call, and a tab that missed a message shows the saved count.
    if (visible.value) feed.reload()
  }

  return { unseenCount, runningCount, toggle, markSeen }
})
