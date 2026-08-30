// The tray shapes one fetched list into what the reader sees: the read-state scope, the type chips and
// their counts, and the day groups. Each rule here is one a wrong answer would hide notifications behind.
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

// Reactive, as the real createResource is — a computed cannot track a plain object's property.
vi.mock('frappe-ui', async () => {
  const { reactive } = await import('vue')
  return {
    createResource: (options) => reactive({ ...options, reload: vi.fn() }),
  }
})
vi.mock('@/utils', () => ({ dayLabel: (v) => String(v).slice(0, 10) }))
globalThis.__ = (text) => text

const store = await import('../../src/stores/notifications.js')
const {
  notifications,
  unreadOnly,
  typeFilter,
  typeCounts,
  visibleNotifications,
  groupedNotifications,
  unreadNotificationsCount,
  setServerUnread,
} = store

const row = (over = {}) => ({
  type: 'Assignment',
  read: 0,
  creation: '2026-08-30 10:00:00',
  ...over,
})

// The endpoint answers with an envelope: the page, the tray's true unread total, and whether more exist.
const served = (items, extra = {}) => ({ items, has_more: false, ...extra })

beforeEach(() => {
  notifications.data = served([])
  unreadOnly.value = true
  typeFilter.value = null
  setServerUnread(null)
})

describe('read-state scope', () => {
  it('hides read rows while Unread is on, and shows them on All', () => {
    notifications.data = served([row(), row({ read: 1 }), row({ read: 1 })])
    expect(visibleNotifications.value).toHaveLength(1)
    unreadOnly.value = false
    expect(visibleNotifications.value).toHaveLength(3)
  })
})

describe('unread count', () => {
  // A page of 50 cannot count a tray of 300, so the envelope's total outranks anything countable here.
  it('takes the total off the envelope, not the page', () => {
    notifications.data = served([row(), row()], { unread: 117 })
    expect(unreadNotificationsCount.value).toBe(117)
  })

  it('lets a socket payload overrule the envelope, including zero', () => {
    notifications.data = served([row(), row()], { unread: 117 })
    setServerUnread(0)
    expect(unreadNotificationsCount.value).toBe(0)
  })

  it('derives from the rows only while neither has spoken', () => {
    notifications.data = served([row(), row(), row({ read: 1 })])
    expect(unreadNotificationsCount.value).toBe(2)
  })
})

describe('type chips', () => {
  it('counts within the read-state scope, not the whole list', () => {
    notifications.data = served([
      row({ type: 'Assignment' }),
      row({ type: 'Assignment', read: 1 }),
      row({ type: 'WhatsApp' }),
    ])
    expect(typeCounts.value).toEqual([
      { type: 'Assignment', count: 1 },
      { type: 'WhatsApp', count: 1 },
    ])
  })

  it('offers whatever type the rows carry, never a hardcoded set', () => {
    notifications.data = served([row({ type: 'Missed Call' })])
    expect(typeCounts.value).toEqual([{ type: 'Missed Call', count: 1 }])
  })

  it('narrows the list to the chosen type', () => {
    notifications.data = served([
      row({ type: 'Assignment' }),
      row({ type: 'Task' }),
    ])
    typeFilter.value = 'Task'
    expect(visibleNotifications.value).toHaveLength(1)
  })

  // Otherwise the last row of a chosen type being read leaves the tray empty with no chip left to click back.
  it('clears a filter whose type has left the scope', async () => {
    notifications.data = served([
      row({ type: 'Task' }),
      row({ type: 'Assignment' }),
    ])
    typeFilter.value = 'Task'
    notifications.data = served([row({ type: 'Assignment' })])
    await nextTick()
    expect(typeFilter.value).toBe(null)
    expect(visibleNotifications.value).toHaveLength(1)
  })
})

describe('day groups', () => {
  it('starts a new group on each new day and keeps the server order', () => {
    notifications.data = served([
      row({ creation: '2026-08-30 11:00:00' }),
      row({ creation: '2026-08-30 09:00:00' }),
      row({ creation: '2026-08-29 18:00:00' }),
    ])
    const groups = groupedNotifications.value
    expect(groups.map((g) => g.key)).toEqual(['2026-08-30', '2026-08-29'])
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].items).toHaveLength(1)
  })

  it('groups only what the filters admit', () => {
    notifications.data = served([
      row({ creation: '2026-08-30 11:00:00' }),
      row({ creation: '2026-08-29 18:00:00', read: 1 }),
    ])
    expect(groupedNotifications.value).toHaveLength(1)
  })
})
