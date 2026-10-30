import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { dayLabel } from '@/utils'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/users'

export const visible = ref(false)

const PAGE_SIZE = 50
// TATVA: the bell reads frappe's own Notification Log through frappe's own API; these are the apps whose notices are the CRM's.
const LOG = 'Notification Log'
const APPS = ['crm', 'tatva_connect']
const NOTICE_METHOD = 'frappe.desk.doctype.notification_log.notification_log'
// TATVA: frappe's link opens a notice; one under the SPA's base routes in the app, anything else (the Desk form) opens as a page.
const SPA = '/crm'

// TATVA: the page grows and the whole page is refetched — the app's own Load More shape (ViewControls refetches 0..N with a bigger page_length), no cursor and no append to keep in step.
export const pageLimit = ref(PAGE_SIZE)

function scope(more = {}) {
  return { for_user: sessionStore().user, app: ['in', APPS], ...more }
}

// TATVA: built only when a fetch runs — never on import, before main.js has set the resource fetcher and pinia exists.
function rowParams() {
  return {
    doctype: LOG,
    fields: ['name', 'creation', 'type', 'title', 'subject', 'from_user', 'read', 'document_type', 'document_name', 'link'],
    filters: scope(),
    order_by: 'creation desc',
    // One row past the page is how "is there more" is known without a second count.
    limit_page_length: pageLimit.value + 1,
  }
}

export const notifications = createResource({ url: 'frappe.client.get_list', initialData: [] })

// TATVA: the count is the server's own COUNT, never the length of a fetched page — a page of 50 cannot count a tray of 300.
const unread = createResource({ url: 'frappe.client.get_count', initialData: 0 })

function reloadAll() {
  notifications.submit(rowParams())
  unread.submit({ doctype: LOG, filters: scope({ read: 0 }) })
}

export function loadMore() {
  pageLimit.value += PAGE_SIZE
  notifications.submit(rowParams())
}

// TATVA: the tray's filters are refs over the rows in hand, not request params — narrowing it is a view over data already fetched.
export const unreadOnly = ref(true)
export const typeFilter = ref(null)

// TATVA: frappe's own 'notification' event fires on every new Notification Log row; rows and count reload together (debounced).
export const reloadSoon = useDebounceFn(reloadAll, 500)

let started = false

// TATVA: once, from App.vue for a logged-in rep, as startBulkJobs: the badge lives in both sidebars, so the listener outlives every screen; a reconnect re-reads what the socket missed.
export function startNotifications(socket) {
  if (started || !socket) return
  started = true
  reloadAll()
  socket.on('notification', reloadSoon)
  socket.io?.on('reconnect', reloadSoon)
}

// The subject is frappe's HTML; DOMParser reads its text without running or loading anything in it.
function plainText(html) {
  return html ? new DOMParser().parseFromString(html, 'text/html').body.textContent.trim() : ''
}

// The SPA's own record pages, for a notice frappe stored with no link (one written while team notices were off).
const RECORD_ROUTES = { 'CRM Lead': ['Lead', 'leadId'], 'CRM Deal': ['Deal', 'dealId'] }

// An in-app route for a link under the SPA's base; with no link, the record's own page; else null and the row opens the link itself.
function appRoute(row) {
  if (!row.link) {
    const [name, param] = RECORD_ROUTES[row.document_type] || []
    return name && row.document_name ? { name, params: { [param]: row.document_name } } : null
  }
  const url = new URL(row.link, window.location.origin)
  if (url.origin !== window.location.origin || !url.pathname.startsWith(SPA + '/')) return null
  return url.pathname.slice(SPA.length) + url.search + url.hash
}

const rows = computed(() => (notifications.data || []).slice(0, pageLimit.value))

// The users store is read per row, never on import: the tray's watch below runs this before pinia exists, with no rows.
export const allNotifications = computed(() =>
  rows.value.map((row) => ({
    name: row.name,
    creation: row.creation,
    type: row.type,
    read: row.read,
    from_user: { name: row.from_user, full_name: row.from_user ? usersStore().getUser(row.from_user).full_name : '' },
    notification_text: plainText(row.title || row.subject),
    reference_doctype: (row.document_type || '').replace('CRM ', '').toLowerCase(),
    reference_name: row.document_name,
    route: appRoute(row),
    link: row.link,
  })),
)

export const hasMore = computed(() => (notifications.data || []).length > pageLimit.value)

export const unreadNotificationsCount = computed(() => unread.data || 0)

// What the read-state filter admits; the type chips count within THIS, so a chip never offers rows the reader cannot see.
const scoped = computed(() =>
  unreadOnly.value
    ? allNotifications.value.filter((n) => !n.read)
    : allNotifications.value,
)

// Read off the rows, never a typed-out list — tatva_connect extends the `type` Select and a copy here would drop every new one.
export const typeCounts = computed(() => {
  const counts = new Map()
  for (const n of scoped.value) {
    const key = n.type || 'Other'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }))
})

// A chosen type whose last row was read leaves the tray filtered to nothing, with no chip left to click back.
watch(typeCounts, (counts) => {
  if (typeFilter.value && !counts.some((c) => c.type === typeFilter.value))
    typeFilter.value = null
})

export const visibleNotifications = computed(() =>
  typeFilter.value
    ? scoped.value.filter((n) => n.type === typeFilter.value)
    : scoped.value,
)

// Same day key and same reader the task board groups by (utils.dayLabel); the list arrives newest-first, so walking it in order keeps the groups in order.
export const groupedNotifications = computed(() => {
  const groups = []
  for (const n of visibleNotifications.value) {
    const key = String(n.creation).slice(0, 10)
    if (!groups.length || groups[groups.length - 1].key !== key)
      groups.push({ key, label: dayLabel(n.creation), items: [] })
    groups[groups.length - 1].items.push(n)
  }
  return groups
})

export const notificationsStore = defineStore('crm-notifications', () => {
  // TATVA: "Mark all as read" is frappe's own, which clears every notice the person has, Helpdesk's included.
  const mark_as_read = createResource({
    url: `${NOTICE_METHOD}.mark_all_as_read`,
    onSuccess: reloadAll,
  })

  const mark_one = createResource({
    url: `${NOTICE_METHOD}.mark_as_read`,
    onSuccess: reloadAll,
  })

  function toggle() {
    visible.value = !visible.value
  }

  function mark_doc_as_read(doc) {
    mark_one.submit({ docname: doc })
  }

  return {
    unreadNotificationsCount,
    mark_as_read,
    mark_doc_as_read,
    toggle,
  }
})
