// Purpose: Settings on the PWA. Stock CRM hides it (a !isMobileView condition + Settings.vue mounted only by the desktop AppSidebar) because the settings SHELL is desktop-bound; this sheet reuses the PANELS behind a mobile shell. What must hold: only the non-manager group is reachable, the list mounts no panel until tapped (zero requests to open Settings), drill/back is symmetric, and closing resets the drill.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountTatva } from './_mount.js'

// vi.hoisted: vi.mock is lifted above the file, so its factories cannot close over ordinary consts.
const { mounted, panelStub } = vi.hoisted(() => {
  const mounted = []
  const panelStub = (name) => ({
    default: {
      name,
      template: `<div data-panel="${name}" />`,
      mounted() {
        mounted.push(name)
      },
    },
  })
  return { mounted, panelStub }
})

vi.mock('@/components/Settings/Profile/ProfilePage.vue', () => panelStub('ProfilePage'))
vi.mock('@/components/Settings/PreferencesSettings.vue', () => panelStub('PreferencesSettings'))
vi.mock('@/tatva/NotificationsSettings.vue', () => panelStub('NotificationsSettings'))
vi.mock('@/stores/users', () => ({
  usersStore: () => ({ getUser: () => ({ full_name: 'Asha Rao', user_image: null }) }),
}))

import SettingsSheet from '@/tatva/SettingsSheet.vue'
import {
  showSettings,
  activeSettingsPage,
  mobileSidebarOpened,
} from '@/composables/settings'

const PANELS = ['Profile', 'Preferences', 'Notifications']
const rows = (w) => w.findAll('li button')
// The label span, not the whole button — the Profile row also renders an Avatar (its initial).
const labels = (w) => w.findAll('li button > span.flex-1').map((s) => s.text().trim())
const tap = (w, label) => rows(w).find((b) => b.text().includes(label)).trigger('click')

beforeEach(() => {
  mounted.length = 0
  showSettings.value = false
  activeSettingsPage.value = ''
  mobileSidebarOpened.value = false
})

describe('SettingsSheet', () => {
  it('lists exactly the non-manager panels — no system settings reachable from a phone', async () => {
    const wrapper = mountTatva(SettingsSheet)
    showSettings.value = true
    await flushPromises()

    expect(labels(wrapper)).toEqual(PANELS)
    for (const forbidden of ['Users', 'Brand', 'General', 'SLA Policies', 'Invite User']) {
      expect(wrapper.text()).not.toContain(forbidden)
    }
  })

  it('mounts NO panel until one is tapped — the list itself costs nothing', async () => {
    const wrapper = mountTatva(SettingsSheet)
    showSettings.value = true
    await flushPromises()

    // Nothing eager: no panel is mounted, so no panel's resources have fired.
    expect(mounted).toEqual([])

    await tap(wrapper, 'Notifications')
    await flushPromises()

    expect(mounted).toEqual(['NotificationsSettings'])
    expect(wrapper.find('[data-panel="NotificationsSettings"]').exists()).toBe(true)
    expect(wrapper.find('[data-panel="PreferencesSettings"]').exists()).toBe(false)
  })

  it('back returns to the list and unmounts the panel', async () => {
    const wrapper = mountTatva(SettingsSheet)
    showSettings.value = true
    await flushPromises()
    await tap(wrapper, 'Preferences')
    await flushPromises()
    expect(wrapper.find('[data-panel="PreferencesSettings"]').exists()).toBe(true)

    await wrapper.get('.shrink-0 button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-panel="PreferencesSettings"]').exists()).toBe(false)
    expect(labels(wrapper)).toEqual(PANELS)
  })

  it('closes the mobile drawer on open — two stacked modals fight over the body scroll lock', async () => {
    mobileSidebarOpened.value = true
    mountTatva(SettingsSheet)
    showSettings.value = true
    await flushPromises()

    expect(mobileSidebarOpened.value).toBe(false)
  })

  it('reopening lands on the list, not wherever it was left', async () => {
    const wrapper = mountTatva(SettingsSheet)
    showSettings.value = true
    await flushPromises()
    await tap(wrapper, 'Profile')
    await flushPromises()
    expect(wrapper.find('[data-panel="ProfilePage"]').exists()).toBe(true)

    showSettings.value = false
    await flushPromises()
    showSettings.value = true
    await flushPromises()

    expect(labels(wrapper)).toEqual(PANELS)
    expect(wrapper.find('[data-panel="ProfilePage"]').exists()).toBe(false)
  })

  it('honours an activeSettingsPage deep-link only when it names a panel we expose', async () => {
    const wrapper = mountTatva(SettingsSheet)
    activeSettingsPage.value = 'Notifications'
    showSettings.value = true
    await flushPromises()
    expect(wrapper.find('[data-panel="NotificationsSettings"]').exists()).toBe(true)

    // Cleared on close, exactly as Settings.vue's @close does.
    showSettings.value = false
    await flushPromises()
    expect(activeSettingsPage.value).toBe('')

    // Templates is desktop-only: fall back to the list rather than open an empty sheet.
    activeSettingsPage.value = 'Templates'
    showSettings.value = true
    await flushPromises()
    expect(labels(wrapper)).toEqual(PANELS)
  })
})
