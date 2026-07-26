// Purpose: NoteModal is the ONE note create/edit modal. Its contract: opening an existing note loads
// the AUTHORITATIVE title/content from the server (a list row may omit content) and its attachments;
// opening blank is a clean create form. Nothing touches the backend until Save, and Save emits exactly
// one outbound write — frappe.client.insert (create) or frappe.client.set_value (edit) — whose payload
// must carry the right reference fields (lead/deal context vs none). On success it emits `saved` and
// closes (update:modelValue=false). Lead-link picker shows only when NOT already in a lead/deal context.
// Writes go through frappe-ui `call` (POST /api/method/<dotted>), captured raw at the MSW boundary.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { FormControl, Button } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod, server, http, HttpResponse } from './_msw.js'

// The app's upload seam is stubbed so we assert the OWNERSHIP contract (doctype/docname/private) each
// staged file is uploaded with, and hand back a proxy file_url the modal must rewrite inline media to.
const { uploadCalls } = vi.hoisted(() => ({ uploadCalls: [] }))
vi.mock('@/components/FilesUploader/filesUploaderHandler', () => ({
  default: class {
    upload(file, options) {
      uploadCalls.push({ name: file?.name, options })
      return Promise.resolve({ file_url: `/private/files/owned-${file.name}` })
    }
  },
}))

import NoteModal from '@/tatva/NoteModal.vue'

const GET_VALUE = 'frappe.client.get_value'
const ATTACHMENTS = 'tatva_connect.api.notes.note_attachments'
const INSERT = 'frappe.client.insert'
const SET_VALUE = 'frappe.client.set_value'

// ResponsiveDialog is its own tested component (ResponsiveDialog.test.js) and the overlay-stub in
// _mount.js only forwards default/body slots — so stub it here to render this modal's body-content +
// actions slots inline, exposing the real title control / Save+Cancel buttons under test.
const ResponsiveDialogStub = {
  name: 'ResponsiveDialog',
  props: ['modelValue', 'options'],
  template: `<div data-stub="dialog"><slot name="body-content" /><slot name="actions" /></div>`,
}
// The rich editor and the permission-scoped lead Link are not this component's contract.
const TextEditorControlStub = {
  name: 'TextEditorControl',
  props: ['value', 'uploadFunction'],
  emits: ['change'],
  template: `<div data-stub="editor" />`,
}
const LinkStub = {
  name: 'Link',
  props: ['doctype', 'value'],
  emits: ['change'],
  template: `<div data-stub="link" />`,
}

function mountModal(props = {}) {
  return mountTatva(NoteModal, {
    props,
    global: {
      stubs: {
        ResponsiveDialog: ResponsiveDialogStub,
        TextEditorControl: TextEditorControlStub,
        Link: LinkStub,
      },
    },
  })
}

const labelOf = (b) => b.props('label')
const button = (wrapper, ...labels) =>
  wrapper.findAllComponents(Button).find((b) => labels.includes(labelOf(b)))

// Deterministic object-URL for staged inline media so the rewrite assertion is exact.
let blobSeq = 0
beforeEach(() => {
  uploadCalls.length = 0
  blobSeq = 0
  URL.createObjectURL = vi.fn(() => `blob:mock-${++blobSeq}`)
  URL.revokeObjectURL = vi.fn()
})

describe('NoteModal', () => {
  it('opens an existing note: loads authoritative title/content + attachments, shows Save', async () => {
    // a list row may carry a stale/blank content — the modal must overwrite from the server.
    mockFrappeMethod(GET_VALUE, { title: 'Server Title', content: '<p>server body</p>' })
    mockFrappeMethod(ATTACHMENTS, [
      { name: 'F1', file_name: 'scan.pdf', file_url: '/files/scan.pdf', is_private: 1 },
    ])
    const wrapper = mountModal({
      modelValue: true,
      note: { name: 'NOTE-1', title: 'Stale Title', content: '' },
    })
    await flushPromises()
    await flushPromises() // attachments resolve a tick after the note doc

    // authoritative server values win over the props.note row values
    expect(wrapper.find('input[type="text"]').element.value).toBe('Server Title')
    // attachments loaded + rendered
    expect(wrapper.text()).toContain('scan.pdf')
    // existing note => Save (not Create)
    expect(button(wrapper, 'Save', 'Create')).toBeTruthy()
    expect(labelOf(button(wrapper, 'Save', 'Create'))).toBe('Save')
  })

  it('opens blank for create: empty title and a Create action', async () => {
    const wrapper = mountModal({ modelValue: true })
    await flushPromises()

    expect(wrapper.find('input[type="text"]').element.value).toBe('')
    expect(wrapper.text()).toContain('No attachments.')
    expect(labelOf(button(wrapper, 'Save', 'Create'))).toBe('Create')
  })

  it('shows the lead-link picker standalone, hides it in a lead/deal context', async () => {
    const standalone = mountModal({ modelValue: true })
    await flushPromises()
    expect(standalone.find('[data-stub="link"]').exists()).toBe(true)

    const inLead = mountModal({
      modelValue: true,
      defaults: { reference_doctype: 'CRM Lead', reference_docname: 'LEAD-1' },
    })
    await flushPromises()
    expect(inLead.find('[data-stub="link"]').exists()).toBe(false)
  })

  it('CREATE save: inserts FCRM Note with the lead/deal reference, emits saved, closes', async () => {
    let saved = null
    server.use(
      http.post(`*/api/method/${INSERT}`, async ({ request }) => {
        saved = await request.json()
        return HttpResponse.json({ message: { name: 'NOTE-NEW' } })
      }),
    )
    const wrapper = mountModal({
      modelValue: true,
      defaults: { reference_doctype: 'CRM Lead', reference_docname: 'LEAD-1' },
    })
    await flushPromises()

    wrapper.findComponent(FormControl).vm.$emit('update:modelValue', 'New note')
    wrapper.findComponent(TextEditorControlStub).vm.$emit('change', '<p>body</p>')
    await button(wrapper, 'Create').get('button').trigger('click')
    await flushPromises()

    // the key contract: the exact outbound insert payload
    expect(saved).toEqual({
      doc: {
        doctype: 'FCRM Note',
        title: 'New note',
        content: '<p>body</p>',
        reference_doctype: 'CRM Lead',
        reference_docname: 'LEAD-1',
      },
    })
    expect(wrapper.emitted('saved')).toEqual([[{ name: 'NOTE-NEW', isInsert: true }]])
    // closed
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
  })

  it('EDIT save: set_value with only the changed fields (no reference when standalone)', async () => {
    mockFrappeMethod(GET_VALUE, { title: 'Server Title', content: '<p>server body</p>' })
    mockFrappeMethod(ATTACHMENTS, [])
    let saved = null
    server.use(
      http.post(`*/api/method/${SET_VALUE}`, async ({ request }) => {
        saved = await request.json()
        return HttpResponse.json({ message: {} })
      }),
    )
    // Distinct note name from the open-existing test above: the note doc is a cache-keyed resource
    // (['tatva-note-doc', name], auto+cache) and frappe-ui's resource cache is module-global with no
    // reset between tests — reusing NOTE-1 would hand this mount the earlier test's resolved resource
    // (bound to its dead component), leaving content unseeded and the payload sending content:''.
    const wrapper = mountModal({
      modelValue: true,
      note: { name: 'NOTE-2', title: 'Stale', content: '' },
    })
    await flushPromises()

    wrapper.findComponent(FormControl).vm.$emit('update:modelValue', 'Edited title')
    await button(wrapper, 'Save').get('button').trigger('click')
    await flushPromises()

    expect(saved).toEqual({
      doctype: 'FCRM Note',
      name: 'NOTE-2',
      fieldname: { title: 'Edited title', content: '<p>server body</p>' },
    })
    expect(wrapper.emitted('saved')).toEqual([[{ name: 'NOTE-2', isInsert: false }]])
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
  })

  it('inline editor media stages locally (no eager upload) and is uploaded OWNED on Save, then the content URL is rewritten', async () => {
    let inserted = null
    let patched = null
    server.use(
      http.post(`*/api/method/${INSERT}`, async ({ request }) => {
        inserted = await request.json()
        return HttpResponse.json({ message: { name: 'NOTE-NEW' } })
      }),
      http.post(`*/api/method/${SET_VALUE}`, async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ message: {} })
      }),
    )
    const wrapper = mountModal({
      modelValue: true,
      defaults: { reference_doctype: 'CRM Lead', reference_docname: 'LEAD-1' },
    })
    await flushPromises()

    // the editor's uploadFunction STAGES the image and returns a local preview — nothing hits the backend
    const editor = wrapper.findComponent(TextEditorControlStub)
    const file = new File(['x'], 'pic.png', { type: 'image/png' })
    const staged = await editor.props('uploadFunction')(file)
    expect(staged.file_url).toBe('blob:mock-1')
    expect(uploadCalls.length).toBe(0) // no eager upload — staged only

    // the editor now emits content carrying the local blob src
    editor.vm.$emit('change', `<p><img src="${staged.file_url}"></p>`)
    await flushPromises()

    await button(wrapper, 'Create').get('button').trigger('click')
    await flushPromises()

    // insert first (to mint a docname), still carrying the local src at this point
    expect(inserted.doc.content).toBe('<p><img src="blob:mock-1"></p>')
    // the staged file is uploaded OWNED by the note: doctype/docname/private carried to the upload seam
    expect(uploadCalls.length).toBe(1)
    expect(uploadCalls[0].name).toBe('pic.png')
    expect(uploadCalls[0].options).toMatchObject({
      doctype: 'FCRM Note',
      docname: 'NOTE-NEW',
      private: true,
    })
    // then the content is patched: the local blob src is rewritten to the owned proxy file_url
    expect(patched).toMatchObject({
      doctype: 'FCRM Note',
      name: 'NOTE-NEW',
      fieldname: { content: '<p><img src="/private/files/owned-pic.png"></p>' },
    })
    expect(wrapper.emitted('saved')).toEqual([[{ name: 'NOTE-NEW', isInsert: true }]])
  })

  it('a separately-Attached file is uploaded OWNED by the note on Save', async () => {
    server.use(
      http.post(`*/api/method/${INSERT}`, async () =>
        HttpResponse.json({ message: { name: 'NOTE-A' } }),
      ),
    )
    const wrapper = mountModal({
      modelValue: true,
      defaults: { reference_doctype: 'CRM Lead', reference_docname: 'LEAD-1' },
    })
    await flushPromises()

    // stage a file through the hidden input the Attach button drives
    const input = wrapper.find('input[type="file"]')
    const file = new File(['y'], 'report.pdf', { type: 'application/pdf' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    // shown as pending, not yet uploaded
    expect(wrapper.text()).toContain('report.pdf')
    expect(wrapper.text()).toContain('pending save')
    expect(uploadCalls.length).toBe(0)

    await button(wrapper, 'Create').get('button').trigger('click')
    await flushPromises()

    expect(uploadCalls.length).toBe(1)
    expect(uploadCalls[0].name).toBe('report.pdf')
    expect(uploadCalls[0].options).toMatchObject({
      doctype: 'FCRM Note',
      docname: 'NOTE-A',
      private: true,
    })
  })

  it('Cancel closes without any backend write', async () => {
    let inserted = false
    server.use(
      http.post(`*/api/method/${INSERT}`, async () => {
        inserted = true
        return HttpResponse.json({ message: { name: 'X' } })
      }),
    )
    const wrapper = mountModal({ modelValue: true })
    await flushPromises()

    await button(wrapper, 'Cancel').get('button').trigger('click')
    await flushPromises()

    expect(inserted).toBe(false)
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})
