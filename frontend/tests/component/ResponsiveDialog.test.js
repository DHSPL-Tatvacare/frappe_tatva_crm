// Purpose: the C.22 invariant — desktop renders the stock frappe-ui Dialog (never a sheet); mobile
// renders TatvaBottomSheet; a modal can force the Dialog with :sheet="false". This swap is what lets a
// modal adopt mobile UX by a single tag change, so it must hold exactly.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountTatva } from './_mount.js'

vi.mock('@/composables/settings', () => ({ isMobileView: { value: false } }))
import { isMobileView } from '@/composables/settings'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'

const sheetStub = { name: 'TatvaBottomSheet', template: '<div data-stub="sheet"><slot /></div>' }
const mountRD = (props) =>
  mountTatva(ResponsiveDialog, { props, global: { stubs: { TatvaBottomSheet: sheetStub } } })

beforeEach(() => (isMobileView.value = false))

describe('ResponsiveDialog', () => {
  it('renders the stock Dialog on desktop, never a sheet', () => {
    isMobileView.value = false
    const wrapper = mountRD({ modelValue: true })
    expect(wrapper.find('[data-stub="Dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-stub="sheet"]').exists()).toBe(false)
  })

  it('renders a bottom sheet on mobile', () => {
    isMobileView.value = true
    const wrapper = mountRD({ modelValue: true })
    expect(wrapper.find('[data-stub="sheet"]').exists()).toBe(true)
    expect(wrapper.find('[data-stub="Dialog"]').exists()).toBe(false)
  })

  it('honours :sheet="false" — stays a Dialog even on mobile', () => {
    isMobileView.value = true
    const wrapper = mountRD({ modelValue: true, sheet: false })
    expect(wrapper.find('[data-stub="Dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-stub="sheet"]').exists()).toBe(false)
  })
})
