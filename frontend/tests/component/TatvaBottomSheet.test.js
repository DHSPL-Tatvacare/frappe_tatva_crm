// Purpose: the one mobile bottom-sheet behaviour (C.20) — content-fit (max-h-[90dvh], never a fixed
// height that leaves a dead white band), renders only when open, shows title + body, and closes on a
// backdrop tap unless dismissOnBackdrop is off, and a swipe closes it from its header, never from its body.
import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
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
    // Close is decoupled from the model (so a v-if parent can't cut the leave slide short): the tap hides
    // the sheet immediately and emits update:modelValue only on @after-leave, which VTU's Transition stub
    // never runs. Assert the on-screen close — the backdrop behaviour under test.
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
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

  // RED before: there was no body rule — the risk is a swipe that throws away a half-typed note or task form.
  it('closes from a swipe on its header but never from a swipe on its body', async () => {
    const realMatchMedia = window.matchMedia
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
    const swipe = async (el) => {
      const fire = (type, y, t) => {
        const e = new Event(type, { bubbles: true, cancelable: true })
        Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientY: y }] })
        Object.defineProperty(e, 'timeStamp', { value: t })
        el.dispatchEvent(e)
      }
      fire('touchstart', 100, 0)
      fire('touchmove', 160, 40)
      fire('touchmove', 400, 80)
      fire('touchend', 400, 90)
      await nextTick()
    }
    try {
      const wrapper = mountTatva(TatvaBottomSheet, {
        props: { modelValue: true, title: 'Note' },
        slots: { default: '<p class="note-body">half a note</p>' },
      })
      await nextTick()
      await swipe(wrapper.get('.note-body').element)
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true) // the body never closes it
      await swipe(wrapper.get('[data-sheet-grab]').element)
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false) // the header does
    } finally {
      window.matchMedia = realMatchMedia
    }
  })
})
