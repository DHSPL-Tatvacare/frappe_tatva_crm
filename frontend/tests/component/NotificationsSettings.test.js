// Purpose: Notifications prefs is a CHANNEL LIST that drills into one channel's switches. Screen 1 names
// Push and Email and summarises each; screen 2a is push (operator-gated — a type the org has not enabled
// is shown greyed and disabled, and a toggle on it never reaches the server); screen 2b is email (NOT
// gated — every row is the rep's, and the master gates the rows below it rather than the org doing so).
// Both resources are fetched once by the container and provided down, so drilling in costs no extra call.
// Endpoints are mocked at the network boundary; push/Notification are stubbed minimally.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { Switch } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod, server, http, HttpResponse } from './_msw.js'

// initTatvaPush is the browser-push glue (FCM/serviceWorker) — not this component's contract; stub it.
vi.mock('@/tatva/push', () => ({ initTatvaPush: vi.fn(), getTatvaDeviceId: vi.fn() }))
import { initTatvaPush } from '@/tatva/push'

import NotificationsSettings from '@/tatva/NotificationsSettings.vue'

const PUSH = 'tatva_connect.notifications.api.get_my_notification_prefs'
const PUSH_SAVE = 'tatva_connect.notifications.api.save_my_notification_prefs'
const EMAIL = 'tatva_connect.notifications.api.get_my_email_prefs'
const EMAIL_SAVE = 'tatva_connect.notifications.api.save_my_email_prefs'

const pushRows = () => [
  { event_key: 'g1', label: 'New lead assigned', description: 'A lead lands in your queue', available: true, enabled: true },
  { event_key: 'g2', label: 'Task due', description: 'A task is due today', available: true, enabled: false },
  { event_key: 'g3', label: 'Pharmacy update', description: 'Order shipped', available: false, enabled: false },
]

const emailPrefs = (masterOn = true) => ({
  master: { fieldname: 'enable_email_notifications', label: 'Email me', description: 'Send these to your inbox as well as the app.', enabled: masterOn },
  rows: [
    { fieldname: 'enable_email_assignment', label: 'Assignments', description: 'A lead or task is assigned to you.', enabled: false },
    { fieldname: 'enable_email_mention', label: 'Mentions', description: 'Someone @mentions you in a comment.', enabled: true },
  ],
})

// pushOn is read at mount from the live permission, so set the browser API before each mount.
function setPermission(value) {
  globalThis.Notification = { permission: value }
}

// Screen 1 renders exactly one plain <button> per channel, in declaration order.
async function drillInto(wrapper, channel) {
  const index = channel === 'push' ? 0 : 1
  await wrapper.findAll('button')[index].trigger('click')
  await flushPromises()
}

async function mountPanel({ push = pushRows(), email = emailPrefs() } = {}) {
  mockFrappeMethod(PUSH, push)
  mockFrappeMethod(EMAIL, email)
  const wrapper = mountTatva(NotificationsSettings)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  initTatvaPush.mockReset()
  setPermission('default')
})
afterEach(() => {
  delete globalThis.Notification
})

describe('NotificationsSettings — screen 1, the channel list', () => {
  it('names both channels and shows no switches at all', async () => {
    const wrapper = await mountPanel()

    expect(wrapper.text()).toContain('Push notifications')
    expect(wrapper.text()).toContain('Email notifications')
    // the list is a decision, not a wall of toggles
    expect(wrapper.findAllComponents(Switch)).toHaveLength(0)
  })

  it('counts push against what the org made AVAILABLE, not the whole catalog', async () => {
    // 2 available (1 on), 1 admin-off -> "1 of 2 on", never "1 of 3"
    const wrapper = await mountPanel()
    expect(wrapper.text()).toContain('1 of 2 on')
  })

  it('summarises email as Off when the master is off, whatever the rows say', async () => {
    // rows carry one enabled row, but with the master off nothing is sent, so a tally there would be a lie
    const wrapper = await mountPanel({ email: emailPrefs(false) })
    const emailRow = wrapper.findAll('button')[1].text()
    expect(emailRow).toContain('Off')
    expect(emailRow).not.toContain('of 2 on')
  })

  it('says Not set up for push when the org has enabled nothing', async () => {
    const wrapper = await mountPanel({ push: [] })
    expect(wrapper.text()).toContain('Not set up')
  })
})

describe('NotificationsSettings — screen 2a, push', () => {
  it('renders one row per catalog event, greying + disabling admin-off types', async () => {
    const wrapper = await mountPanel()
    await drillInto(wrapper, 'push')

    expect(wrapper.text()).toContain('New lead assigned')
    expect(wrapper.text()).toContain('Task due')
    expect(wrapper.text()).toContain('Pharmacy update')
    expect(wrapper.text()).toContain('Not enabled by your admin')

    // index 0 = the device master, then one per row in order
    const switches = wrapper.findAllComponents(Switch)
    expect(switches).toHaveLength(1 + 3)
    expect(switches[1].props('disabled')).toBe(false)
    expect(switches[2].props('disabled')).toBe(false)
    expect(switches[3].props('disabled')).toBe(true)
    expect(switches[1].props('modelValue')).toBe(true)
    expect(switches[2].props('modelValue')).toBe(false)
  })

  it('shows the EmptyState when the org has enabled nothing', async () => {
    const wrapper = await mountPanel({ push: [] })
    await drillInto(wrapper, 'push')

    expect(wrapper.text()).toContain('Nothing to subscribe to yet')
    expect(wrapper.findAllComponents(Switch)).toHaveLength(1) // the device master alone
  })

  it('toggling an available event optimistically flips it and persists the full set', async () => {
    let saved = null
    server.use(
      http.post(`*/api/method/${PUSH_SAVE}`, async ({ request }) => {
        saved = await request.json()
        return HttpResponse.json({ message: {} })
      }),
    )
    const wrapper = await mountPanel()
    await drillInto(wrapper, 'push')

    wrapper.findAllComponents(Switch)[2].vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(saved.prefs).toEqual([
      { event_key: 'g1', enabled: true },
      { event_key: 'g2', enabled: true }, // optimistic flip persisted
      { event_key: 'g3', enabled: false },
    ])
  })

  it('never persists when an admin-off event is toggled', async () => {
    let calls = 0
    server.use(
      http.post(`*/api/method/${PUSH_SAVE}`, async () => {
        calls += 1
        return HttpResponse.json({ message: {} })
      }),
    )
    const wrapper = await mountPanel()
    await drillInto(wrapper, 'push')

    wrapper.findAllComponents(Switch)[3].vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(calls).toBe(0)
  })

  it('mirrors the live browser permission on the device master, and enabling drives initTatvaPush()', async () => {
    setPermission('granted')
    const wrapper = await mountPanel({ push: [] })
    await drillInto(wrapper, 'push')
    expect(wrapper.findAllComponents(Switch)[0].props('modelValue')).toBe(true)

    setPermission('default')
    const off = await mountPanel({ push: [] })
    await drillInto(off, 'push')
    expect(off.findAllComponents(Switch)[0].props('modelValue')).toBe(false)

    off.findAllComponents(Switch)[0].vm.$emit('update:modelValue', true)
    await flushPromises()
    expect(initTatvaPush).toHaveBeenCalledTimes(1)
  })
})

describe('NotificationsSettings — screen 2b, email', () => {
  it('renders the master and one row per kind, and greys NOTHING when the master is on', async () => {
    const wrapper = await mountPanel()
    await drillInto(wrapper, 'email')

    expect(wrapper.text()).toContain('Email me')
    expect(wrapper.text()).toContain('Assignments')
    expect(wrapper.text()).toContain('Mentions')

    const switches = wrapper.findAllComponents(Switch)
    expect(switches).toHaveLength(1 + 2)
    // email is NOT operator-gated: every row is live
    expect(switches[1].props('disabled')).toBe(false)
    expect(switches[2].props('disabled')).toBe(false)
    expect(switches[1].props('modelValue')).toBe(false)
    expect(switches[2].props('modelValue')).toBe(true)
  })

  it('disables the rows while the master is off, because nothing is sent then', async () => {
    const wrapper = await mountPanel({ email: emailPrefs(false) })
    await drillInto(wrapper, 'email')

    const switches = wrapper.findAllComponents(Switch)
    expect(switches[0].props('modelValue')).toBe(false)
    expect(switches[1].props('disabled')).toBe(true)
    expect(switches[2].props('disabled')).toBe(true)
    expect(wrapper.text()).toContain('Turn on Email to use this')
  })

  it('toggling a kind persists the master and every row as one fieldname map', async () => {
    let saved = null
    server.use(
      http.post(`*/api/method/${EMAIL_SAVE}`, async ({ request }) => {
        saved = await request.json()
        return HttpResponse.json({ message: {} })
      }),
    )
    const wrapper = await mountPanel()
    await drillInto(wrapper, 'email')

    wrapper.findAllComponents(Switch)[1].vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(saved.prefs).toEqual({
      enable_email_notifications: true,
      enable_email_assignment: true, // optimistic flip persisted
      enable_email_mention: true,
    })
  })

  it('toggling the master goes through the SAME payload path as a row', async () => {
    let saved = null
    server.use(
      http.post(`*/api/method/${EMAIL_SAVE}`, async ({ request }) => {
        saved = await request.json()
        return HttpResponse.json({ message: {} })
      }),
    )
    const wrapper = await mountPanel({ email: emailPrefs(false) })
    await drillInto(wrapper, 'email')

    wrapper.findAllComponents(Switch)[0].vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(saved.prefs.enable_email_notifications).toBe(true)
    expect(Object.keys(saved.prefs)).toHaveLength(3)
  })
})

describe('NotificationsSettings — navigation', () => {
  it('the back button on a channel screen returns to the list', async () => {
    const wrapper = await mountPanel()
    await drillInto(wrapper, 'email')
    expect(wrapper.text()).toContain('Email me')

    // the back Button is the first button on the detail screen
    await wrapper.findAll('button')[0].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Push notifications')
    expect(wrapper.text()).toContain('Email notifications')
    expect(wrapper.findAllComponents(Switch)).toHaveLength(0)
  })
})
