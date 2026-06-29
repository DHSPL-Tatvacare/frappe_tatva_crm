// Purpose: the Notifications prefs panel renders ONE row per server-catalog grain (only the org's
// globally-enabled types reach the rep), greys + disables types the admin hasn't turned on, and a
// rep's toggle optimistically flips the row and persists the WHOLE prefs set via
// save_my_notification_prefs. The master "push on this device" switch mirrors the live browser
// Notification permission (not a stored flag) and enabling it drives initTatvaPush(). Rows come from
// get_my_notification_prefs, mocked at the network boundary; push/Notification are stubbed minimally.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { Switch } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod, server, http, HttpResponse } from './_msw.js'

// initTatvaPush is the browser-push glue (FCM/serviceWorker) — not this component's contract; stub it.
vi.mock('@/tatva/push', () => ({ initTatvaPush: vi.fn(), getTatvaDeviceId: vi.fn() }))
import { initTatvaPush } from '@/tatva/push'

import NotificationsSettings from '@/tatva/NotificationsSettings.vue'

const PREFS = 'tatva_connect.notifications.api.get_my_notification_prefs'
const SAVE = 'tatva_connect.notifications.api.save_my_notification_prefs'

const rows = [
  { grain_key: 'g1', label: 'New lead assigned', description: 'A lead lands in your queue', available: true, enabled: true },
  { grain_key: 'g2', label: 'Task due', description: 'A task is due today', available: true, enabled: false },
  { grain_key: 'g3', label: 'Pharmacy update', description: 'Order shipped', available: false, enabled: false },
]

// pushOn is read at mount from the live permission, so set the browser API before each mount.
function setPermission(value) {
  globalThis.Notification = { permission: value }
}

beforeEach(() => {
  initTatvaPush.mockReset()
  setPermission('default')
})
afterEach(() => {
  delete globalThis.Notification
})

describe('NotificationsSettings', () => {
  it('renders one row per catalog grain, greying + disabling admin-off types', async () => {
    mockFrappeMethod(PREFS, rows)
    const wrapper = mountTatva(NotificationsSettings)
    await flushPromises()

    expect(wrapper.text()).toContain('New lead assigned')
    expect(wrapper.text()).toContain('Task due')
    expect(wrapper.text()).toContain('Pharmacy update')
    // admin-off type swaps its description for the not-enabled note
    expect(wrapper.text()).toContain('Not enabled by your admin')

    // switches: index 0 = master push, then one per row in order
    const switches = wrapper.findAllComponents(Switch)
    expect(switches).toHaveLength(1 + rows.length)
    expect(switches[1].props('disabled')).toBe(false) // available
    expect(switches[2].props('disabled')).toBe(false) // available
    expect(switches[3].props('disabled')).toBe(true) // admin-off → disabled
    // model reflects stored enabled flags
    expect(switches[1].props('modelValue')).toBe(true)
    expect(switches[2].props('modelValue')).toBe(false)
  })

  it('shows the EmptyState when the org has enabled nothing', async () => {
    mockFrappeMethod(PREFS, [])
    const wrapper = mountTatva(NotificationsSettings)
    await flushPromises()

    expect(wrapper.text()).toContain('Nothing to subscribe to yet')
    // only the master push switch — no grain rows
    expect(wrapper.findAllComponents(Switch)).toHaveLength(1)
  })

  it('toggling an available grain optimistically flips it and persists the full prefs set', async () => {
    mockFrappeMethod(PREFS, rows)
    let saved = null
    server.use(
      http.post(`*/api/method/${SAVE}`, async ({ request }) => {
        saved = await request.json()
        return HttpResponse.json({ message: {} })
      }),
    )
    const wrapper = mountTatva(NotificationsSettings)
    await flushPromises()

    // turn ON the currently-off "Task due" row (g2)
    const taskSwitch = wrapper.findAllComponents(Switch)[2]
    taskSwitch.vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(saved).not.toBeNull()
    expect(saved.prefs).toEqual([
      { grain_key: 'g1', enabled: true },
      { grain_key: 'g2', enabled: true }, // optimistic flip persisted
      { grain_key: 'g3', enabled: false },
    ])
  })

  it('never persists when an admin-off (disabled) grain is toggled', async () => {
    mockFrappeMethod(PREFS, rows)
    let calls = 0
    server.use(
      http.post(`*/api/method/${SAVE}`, async () => {
        calls += 1
        return HttpResponse.json({ message: {} })
      }),
    )
    const wrapper = mountTatva(NotificationsSettings)
    await flushPromises()

    // even if an emit slips through, toggleGrain's `if (!row.available) return` guards it
    wrapper.findAllComponents(Switch)[3].vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(calls).toBe(0)
  })

  it('reflects a granted browser permission as the master push switch being ON', async () => {
    setPermission('granted')
    mockFrappeMethod(PREFS, [])
    const wrapper = mountTatva(NotificationsSettings)
    await flushPromises()

    expect(wrapper.findAllComponents(Switch)[0].props('modelValue')).toBe(true)
  })

  it('starts the master push switch OFF when permission is not granted', async () => {
    setPermission('default')
    mockFrappeMethod(PREFS, [])
    const wrapper = mountTatva(NotificationsSettings)
    await flushPromises()

    expect(wrapper.findAllComponents(Switch)[0].props('modelValue')).toBe(false)
  })

  it('enabling the master push switch drives initTatvaPush()', async () => {
    setPermission('default')
    mockFrappeMethod(PREFS, [])
    const wrapper = mountTatva(NotificationsSettings)
    await flushPromises()

    wrapper.findAllComponents(Switch)[0].vm.$emit('update:modelValue', true)
    await flushPromises()

    expect(initTatvaPush).toHaveBeenCalledTimes(1)
  })
})
