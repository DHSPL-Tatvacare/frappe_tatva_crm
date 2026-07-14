// Purpose: the one mobile bottom-sheet behaviour (C.20) — content-fit (max-h-[90dvh], never a fixed
// height that leaves a dead white band), renders only when open, shows title + body, and closes on a
// backdrop tap unless dismissOnBackdrop is off. Drag-to-dismiss gestures are covered by E2E.
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import TatvaBottomSheet from '@/tatva/TatvaBottomSheet.vue'

describe('TatvaBottomSheet', () => {
  it('renders nothing when closed', () => {
    const wrapper = mountTatva(TatvaBottomSheet, { props: { modelValue: false, title: 'Pick' } })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('is content-fit and shows title + body when open', () => {
    const wrapper = mountTatva(TatvaBottomSheet, {
      props: { modelValue: true, title: 'Pick a stage' },
      slots: { default: '<p>sheet body</p>' },
    })
    const sheet = wrapper.find('[role="dialog"]')
    expect(sheet.exists()).toBe(true)
    expect(sheet.classes()).toContain('max-h-[90dvh]') // content-fit, not a fixed height (C.20)
    expect(wrapper.text()).toContain('Pick a stage')
    expect(wrapper.text()).toContain('sheet body')
  })

  it('closes on backdrop tap by default', async () => {
    const wrapper = mountTatva(TatvaBottomSheet, { props: { modelValue: true } })
    await wrapper.get('.z-40').trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
  })

  it('does not close on backdrop when dismissOnBackdrop is false', async () => {
    const wrapper = mountTatva(TatvaBottomSheet, {
      props: { modelValue: true, dismissOnBackdrop: false },
    })
    await wrapper.get('.z-40').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  // A sheet has three exits (backdrop, Escape, drag-down). A phone has no Escape key, so one that opts out of both gestures cannot be closed at all. Drag-to-dismiss is therefore not optional.
  it('exposes no way to turn drag-to-dismiss off, so a sheet can never have zero exits', () => {
    expect(Object.keys(TatvaBottomSheet.props)).not.toContain('dismissible')
    // Even with the backdrop route off, the drag handle is still rendered, so an exit always survives.
    const wrapper = mountTatva(TatvaBottomSheet, {
      props: { modelValue: true, dismissOnBackdrop: false },
    })
    expect(wrapper.find('.cursor-grab').exists()).toBe(true)
  })
})
