// Purpose: the WhatsApp Send-Template dialog is the ONLY composer when the 24h window is shut, so its
// server contract must hold exactly. On open it loads ONE context method (grain-routed account + mobile
// + approved templates); with no route it blocks sending; picking a template loads that template's body
// + variables and renders a safe preview (chips, never v-html); sending fires send_template_with_params
// and emits 'sent' only when every variable is filled. Data is mocked at the network boundary with MSW
// (frappe-ui's own convention) so the real `call` path is exercised — internals are never stubbed.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountTatva } from './_mount.js'
import { http, HttpResponse } from 'msw'
import { mockFrappeMethod, server } from './_msw.js'

// toast is a UI side-effect (DOM-mounting), not the contract — neutralise it but keep everything else
// (Button/FormControl/call) real so the network path stays genuine.
vi.mock('frappe-ui', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, toast: { success: vi.fn(), error: vi.fn() } }
})
import { toast } from 'frappe-ui'

import TatvaWhatsAppTemplate from '@/tatva/TatvaWhatsAppTemplate.vue'

const M = 'tatva_connect.api.whatsapp'

// Stub the two non-contract children: the dialog shell (render its slots inline regardless of viewport)
// and the template picker (so we can drive its real `change` event without the heavy combobox DOM).
const ResponsiveDialogStub = {
  name: 'ResponsiveDialog',
  template: `<div data-stub="rd"><slot name="body-content" /><slot name="actions" /></div>`,
}
const AutocompleteStub = {
  name: 'Autocomplete',
  props: ['options', 'value', 'placeholder'],
  emits: ['change'],
  template: `<div data-stub="autocomplete" />`,
}

function mountWA(props = {}) {
  return mountTatva(TatvaWhatsAppTemplate, {
    props: { doctype: 'CRM Lead', docname: 'LEAD-1', modelValue: false, ...props },
    global: { stubs: { ResponsiveDialog: ResponsiveDialogStub, Autocomplete: AutocompleteStub } },
  })
}

// Open the dialog (loadContext only fires on the show watcher transitioning to true).
async function open(wrapper) {
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
}

const sendBtn = (wrapper) => wrapper.findAll('button').find((b) => b.text() === 'Send')

const account = { name: 'WATI ZZ Line', number: '+919900000000' }

beforeEach(() => {
  toast.success.mockClear()
  toast.error.mockClear()
})

describe('TatvaWhatsAppTemplate', () => {
  it('blocks sending when the lead has no WATI account route', async () => {
    mockFrappeMethod(`${M}.get_send_context`, { account: null, mobile_no: '+918888888888', templates: [] })
    const wrapper = mountWA()
    await open(wrapper)
    expect(wrapper.text()).toContain('no WATI account route')
    expect(sendBtn(wrapper)).toBeUndefined() // #actions is gated on `account`
  })

  it('shows the account route and the empty-templates hint when none are synced', async () => {
    mockFrappeMethod(`${M}.get_send_context`, { account, mobile_no: '+918888888888', templates: [] })
    const wrapper = mountWA()
    await open(wrapper)
    expect(wrapper.text()).toContain('WATI ZZ Line')
    expect(wrapper.text()).toContain('+918888888888')
    expect(wrapper.text()).toContain('No approved templates synced yet')
    expect(sendBtn(wrapper)).toBeUndefined() // Send is gated on a picked template; none synced yet
  })

  it('renders the picker (not the empty hint) once approved templates load', async () => {
    mockFrappeMethod(`${M}.get_send_context`, {
      account,
      mobile_no: '+918888888888',
      templates: [{ name: 'welcome', label: 'Welcome', category: 'UTILITY', vars: 0 }],
    })
    const wrapper = mountWA()
    await open(wrapper)
    expect(wrapper.text()).not.toContain('No approved templates synced yet')
    expect(wrapper.findComponent({ name: 'Autocomplete' }).props('options')).toHaveLength(1)
  })

  it('picking a template loads its body + variables and renders a safe preview chip', async () => {
    mockFrappeMethod(`${M}.get_send_context`, {
      account,
      mobile_no: '+918888888888',
      templates: [{ name: 'reminder', label: 'Reminder', category: 'UTILITY', vars: 1 }],
    })
    mockFrappeMethod(`${M}.get_template_variables`, {
      body: 'Hi {{1}}, your visit is booked.',
      variables: [{ index: 1, name: 'patient_name', hint: 'Asha' }],
    })
    mockFrappeMethod(`${M}.get_field_options`, [])
    const wrapper = mountWA()
    await open(wrapper)
    wrapper.findComponent({ name: 'Autocomplete' }).vm.$emit('change', { value: 'reminder' })
    await flushPromises()
    // preview is split into safe segments: literal text + a named chip (never the raw {{1}})
    expect(wrapper.text()).toContain('Hi')
    expect(wrapper.text()).toContain('your visit is booked.')
    expect(wrapper.text()).toContain('patient_name')
    expect(wrapper.text()).not.toContain('{{1}}')
    // one shared value control per variable — which editor each mode gets is ValueInput's own spec
    expect(wrapper.findAllComponents({ name: 'ValueInput' })).toHaveLength(1)
  })

  it('a variable filled from a field travels as the field, and the value is read at send time', async () => {
    mockFrappeMethod(`${M}.get_send_context`, {
      account,
      mobile_no: '+918888888888',
      templates: [{ name: 'reminder', label: 'Reminder', category: 'UTILITY', vars: 1 }],
    })
    mockFrappeMethod(`${M}.get_template_variables`, { body: 'Hi {{1}}', variables: [{ index: 1 }] })
    mockFrappeMethod(`${M}.get_field_options`, [
      { group: 'Lead', options: [{ field: 'lead:first_name', label: 'First Name', value: 'Asha' }] },
    ])
    let sent = null
    server.use(
      http.post(`*/api/method/${M}.send_template_with_params`, async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ message: 'WA-0001' })
      }),
    )
    const wrapper = mountWA()
    await open(wrapper)
    wrapper.findComponent({ name: 'Autocomplete' }).vm.$emit('change', { value: 'reminder' })
    await flushPromises()
    const fill = wrapper.findComponent({ name: 'ValueInput' })
    expect(fill.props('valueRows')[0]).toMatchObject({ value: 'lead:first_name', description: 'Asha' })
    fill.vm.$emit('update:modelValue', { mode: 'From a field', value: 'lead:first_name' })
    await flushPromises()
    await sendBtn(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.emitted('sent')).toBeTruthy()
    expect(JSON.parse(sent.field_param)).toEqual({ 1: 'lead:first_name' })
    expect(sent.body_param).toBeNull()
  })

  it('sends a no-variable template and emits "sent", then closes', async () => {
    mockFrappeMethod(`${M}.get_send_context`, {
      account,
      mobile_no: '+918888888888',
      templates: [{ name: 'welcome', label: 'Welcome', category: 'UTILITY', vars: 0 }],
    })
    mockFrappeMethod(`${M}.get_template_variables`, { body: 'Welcome aboard!', variables: [] })
    mockFrappeMethod(`${M}.send_template_with_params`, { ok: true })
    const wrapper = mountWA()
    await open(wrapper)
    wrapper.findComponent({ name: 'Autocomplete' }).vm.$emit('change', { value: 'welcome' })
    await flushPromises()
    await sendBtn(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.emitted('sent')).toHaveLength(1)
    // closes via v-model (show.value = false)
    const updates = wrapper.emitted('update:modelValue') || []
    expect(updates.at(-1)).toEqual([false])
  })

  it('refuses to send (no "sent") when a required variable is left empty', async () => {
    mockFrappeMethod(`${M}.get_send_context`, {
      account,
      mobile_no: '+918888888888',
      templates: [{ name: 'reminder', label: 'Reminder', category: 'UTILITY', vars: 1 }],
    })
    mockFrappeMethod(`${M}.get_template_variables`, {
      body: 'Hi {{1}}',
      variables: [{ index: 1, name: 'patient_name' }],
    })
    mockFrappeMethod(`${M}.get_field_options`, [])
    const wrapper = mountWA()
    await open(wrapper)
    wrapper.findComponent({ name: 'Autocomplete' }).vm.$emit('change', { value: 'reminder' })
    await flushPromises()
    await sendBtn(wrapper).trigger('click') // variable still blank
    await flushPromises()
    expect(wrapper.emitted('sent')).toBeFalsy()
    expect(toast.error).toHaveBeenCalled()
  })
})
