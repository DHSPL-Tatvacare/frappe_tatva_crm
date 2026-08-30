import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import { dayLabel } from '@/utils'

export const visible = ref(false)

const PAGE_SIZE = 50

// TATVA: the page grows and the whole page is refetched — the app's own Load More shape (ViewControls refetches 0..N with a bigger page_length), no cursor and no append to keep in step.
export const pageLimit = ref(PAGE_SIZE)

export const notifications = createResource({
  url: 'crm.api.notifications.get_notifications',
  initialData: { items: [], unread: 0, has_more: false },
  makeParams: () => ({ limit: pageLimit.value }),
  auto: true,
  onSuccess: () => setServerUnread(null),
})

export function loadMore() {
  pageLimit.value += PAGE_SIZE
  notifications.reload()
}

// TATVA: the tray's filters are refs over the resource, not resource params — the endpoint returns this user's whole tray in one call, so narrowing it is a view over data already in hand.
export const unreadOnly = ref(true)
export const typeFilter = ref(null)

// TATVA: the count is the server's — the socket payload first, then the envelope, and only derived from rows if neither has spoken. A page of 50 cannot count a tray of 300.
const serverUnread = ref(null)

export function setServerUnread(count) {
  serverUnread.value = Number.isFinite(count) ? count : null
}

export const allNotifications = computed(() => notifications.data?.items || [])

export const hasMore = computed(() => !!notifications.data?.has_more)

export const unreadNotificationsCount = computed(() => {
  if (serverUnread.value !== null) return serverUnread.value
  const served = notifications.data?.unread
  return Number.isFinite(served)
    ? served
    : allNotifications.value.filter((n) => !n.read).length
})

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
  const mark_as_read = createResource({
    url: 'crm.api.notifications.mark_as_read',
    onSuccess: () => {
      mark_as_read.params = {}
      notifications.reload()
    },
  })

  function toggle() {
    visible.value = !visible.value
  }

  function mark_doc_as_read(doc) {
    mark_as_read.params = { doc: doc }
    mark_as_read.reload()
  }

  return {
    unreadNotificationsCount,
    mark_as_read,
    mark_doc_as_read,
    toggle,
  }
})
