// Purpose: the closed-24h-window card states WHY free text is blocked and offers the template path.
// It must always render the explanation and emit 'send-template' so WhatsAppBox can open the dialog —
// this is the only composer a rep sees when the window is shut (A.11-adjacent UX).
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import TatvaWhatsAppWindowNotice from '@/tatva/TatvaWhatsAppWindowNotice.vue'

describe('TatvaWhatsAppWindowNotice', () => {
  it('explains why the chat is closed', () => {
    const wrapper = mountTatva(TatvaWhatsAppWindowNotice)
    expect(wrapper.text()).toContain('resolved and expired')
    expect(wrapper.text()).toContain('template messages')
  })

  it('emits send-template when the rep clicks Send Template', async () => {
    const wrapper = mountTatva(TatvaWhatsAppWindowNotice)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('send-template')).toHaveLength(1)
  })
})
