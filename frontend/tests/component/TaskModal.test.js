// Purpose: TaskModal is the ONE native task modal (create / edit / view / log / complete). Its contract:
// on open it seeds standard CRM Task fields (create) or loads the full task via
// tatva_connect.activity.api.task_detail (edit/view); it scopes the Task Type picker to the lead via
// the grain-scoped tatva_connect.activity.api.list_types_for_lead resource (the composite `::` PK is the
// option VALUE, never visible text); picking a type loads THAT type's schema via type_config; Save writes
// through the right brain — a PLAIN task goes straight to frappe.client.insert / set_value, a TYPED task
// runs resolveLocation -> compute_activity_fields -> insert (create) or set_value + save_activity (edit),
// and a missing required schema field gates the save with an inline error. Close emits update:modelValue
// false; a successful save emits 'saved' with the task name. Network is mocked at the boundary (MSW);
// outbound save payloads are captured with raw handlers. Heavy controls (Link/editor/pickers/map) and the
// teleporting ResponsiveDialog are stubbed so we test THIS component's logic, not theirs.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { FormControl } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod, server, http, HttpResponse } from './_msw.js'

// The app's upload seam is stubbed so we assert the OWNERSHIP contract each staged inline file uploads
// with (doctype/docname/private) and hand back a proxy file_url the modal must rewrite the description to.
const { uploadCalls } = vi.hoisted(() => ({ uploadCalls: [] }))
vi.mock('@/components/FilesUploader/filesUploaderHandler', () => ({
  default: class {
    upload(file, options) {
      uploadCalls.push({ name: file?.name, options })
      return Promise.resolve({ file_url: `/private/files/owned-${file.name}` })
    }
  },
}))

// usersStore pulls in pinia + vue-router (app context we don't boot). Only getUser is used (view mode
// assignee label), so mock it to a deterministic shape.
vi.mock('@/stores/users', () => ({
  usersStore: () => ({ getUser: (email) => ({ full_name: email }) }),
}))

import TaskModal from '@/tatva/TaskModal.vue'

const TASK_DETAIL = 'tatva_connect.activity.api.task_detail'
const LIST_TYPES = 'tatva_connect.activity.api.list_types_for_lead'
const TYPE_CONFIG = 'tatva_connect.activity.api.type_config'
const LOCATION_NEEDED = 'tatva_connect.location.api.location_needed'
const COMPUTE = 'tatva_connect.activity.api.compute_activity_fields'
const SAVE_ACTIVITY = 'tatva_connect.activity.api.save_activity'
const INSERT = 'frappe.client.insert'
const SET_VALUE = 'frappe.client.set_value'

const TYPE_PK = 'ZZ Care::ZZ Group::ZZ Program::doctor_visit'
const TYPES = [{ name: TYPE_PK, label: 'Doctor Visit' }]

// type_config answers with the flat field list AND the tree the form renders (activity/api.py:_layout):
// tabs -> sections -> columns, a column NAMING its fields rather than restating them. This is the default
// a type with no layout markers yields — one tab, one section, one column.
const BP_FIELD = {
  fieldname: 'bp', label: 'Blood Pressure', fieldtype: 'Data', reqd: 1,
  depends_on: '', mandatory_depends_on: '', container_depends_on: [],
}
const BP_CONFIG = {
  fields: [BP_FIELD],
  tabs: [
    {
      key: 'tab-1', label: '',
      sections: [
        { key: 'section-2', label: '', columns: [{ key: 'column-3', label: '', fields: ['bp'] }] },
      ],
    },
  ],
  captures_location: false,
}

// Stub the teleporting dialog wrapper so the three slots render inline and the real frappe-ui Buttons in
// #actions are clickable.
const ResponsiveDialogStub = {
  name: 'ResponsiveDialog',
  template:
    '<div data-stub="rd"><slot name="body-title" /><slot name="body-content" /><slot name="actions" /></div>',
}
const leafStub = (name) => ({ name, template: `<div data-stub="${name}" />` })
// Editor stub that keeps the uploadFunction prop + change emit so the inline-staging path is drivable.
const TextEditorControlStub = {
  name: 'TextEditorControl',
  props: ['value', 'uploadFunction'],
  emits: ['change'],
  template: `<div data-stub="TextEditorControl" />`,
}

const STUBS = {
  ResponsiveDialog: ResponsiveDialogStub,
  Link: leafStub('Link'),
  TextEditorControl: TextEditorControlStub,
  AttachControl: leafStub('AttachControl'),
  DateTimePicker: leafStub('DateTimePicker'),
  DatePicker: leafStub('DatePicker'),
  TatvaMiniMap: leafStub('TatvaMiniMap'),
}

function mountModal(props = {}) {
  return mountTatva(TaskModal, {
    props: { modelValue: true, ...props },
    global: { stubs: STUBS },
  })
}

// Capture the outbound POST body for a whitelisted method; returns a live box with the last payload + call
// count and replies with the given `message` (call() unwraps response.message).
function capture(method, message = {}) {
  const box = { payload: null, calls: 0 }
  server.use(
    http.post(`*/api/method/${method}`, async ({ request }) => {
      box.calls += 1
      box.payload = await request.json()
      return HttpResponse.json({ message })
    }),
  )
  return box
}

const btn = (wrapper, label) => wrapper.findAll('button').find((b) => b.text() === label)

// FormControl type="select" renders a reka teleporting combobox (no native <select>). `options`/
// `modelValue` fall through to $attrs (not declared props), so read them off vm.$attrs; identify each
// control by its options and drive its v-model via the FormControl's update:modelValue emit (invariant 4).
const fcs = (wrapper) => wrapper.findAllComponents(FormControl)
const optsOf = (fc) => fc.vm.$attrs.options || []
const mvOf = (fc) => fc.vm.$attrs.modelValue
const statusFc = (wrapper) => fcs(wrapper).find((fc) => optsOf(fc).includes?.('In Progress'))
const priorityFc = (wrapper) => fcs(wrapper).find((fc) => optsOf(fc).includes?.('Medium'))
const typeFc = (wrapper) =>
  fcs(wrapper).find((fc) => optsOf(fc)[0]?.value === '' && /Select a task type/.test(optsOf(fc)[0]?.label || ''))
const pickType = async (wrapper, pk) => {
  typeFc(wrapper).vm.$emit('update:modelValue', pk)
  await flushPromises()
}

let blobSeq = 0
beforeEach(() => {
  // list_types is reloaded on every open with a lead in context; default to empty so plain-task tests
  // don't hit the network unmocked.
  mockFrappeMethod(LIST_TYPES, [])
  uploadCalls.length = 0
  blobSeq = 0
  URL.createObjectURL = vi.fn(() => `blob:mock-${++blobSeq}`)
  URL.revokeObjectURL = vi.fn()
})

describe('TaskModal', () => {
  it('opens in create mode with editable standard fields seeded to defaults', async () => {
    const wrapper = mountModal({ mode: 'create', lead: 'LEAD-1' })
    await flushPromises()

    // editing path: Create / Cancel actions (not the view-mode Edit / Close)
    expect(btn(wrapper, 'Create')).toBeTruthy()
    expect(btn(wrapper, 'Cancel')).toBeTruthy()
    // title input present; status + priority selects seeded from STD_DEFAULTS
    expect(wrapper.find('input[placeholder="Task title"]').exists()).toBe(true)
    expect(mvOf(statusFc(wrapper))).toBe('Todo')
    expect(mvOf(priorityFc(wrapper))).toBe('Low')
    // status select carries the full STATUS_OPTIONS set
    expect(optsOf(statusFc(wrapper))).toEqual(['Backlog', 'Todo', 'In Progress', 'Done', 'Canceled'])
  })

  it('loads the full task via task_detail in view mode and renders read-only values', async () => {
    mockFrappeMethod(TASK_DETAIL, {
      task: {
        name: 'TASK-1',
        title: 'Follow up with patient',
        status: 'In Progress',
        priority: 'High',
        description: 'Call before noon',
        assigned_to: 'rep@x.io',
        reference_doctype: 'CRM Lead',
        reference_docname: '',
        values: {},
      },
      config: null,
    })
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-1' } })
    await flushPromises()

    expect(wrapper.text()).toContain('Follow up with patient')
    expect(wrapper.text()).toContain('In Progress') // status badge
    expect(wrapper.text()).toContain('High') // priority
    expect(wrapper.text()).toContain('Call before noon') // description
    // view mode shows Edit / Close, not the editable Save
    expect(btn(wrapper, 'Edit')).toBeTruthy()
    expect(btn(wrapper, 'Close')).toBeTruthy()
    expect(btn(wrapper, 'Save')).toBeFalsy()
  })

  it('populates the Task Type picker from list_types_for_lead, showing the label and never the :: PK', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    const wrapper = mountModal({ mode: 'create', lead: 'LEAD-1' })
    await flushPromises()

    const options = optsOf(typeFc(wrapper))
    const opt = options.find((o) => o.label === 'Doctor Visit') // human label
    expect(opt).toBeTruthy()
    expect(opt.value).toBe(TYPE_PK) // composite PK is the VALUE the server expects
    // no option exposes the :: PK as its visible label
    expect(options.every((o) => !/::/.test(o.label))).toBe(true)
  })

  it('saves a PLAIN task with frappe.client.insert and emits saved + closes', async () => {
    const ins = capture(INSERT, { name: 'TASK-NEW' })
    const wrapper = mountModal({ mode: 'create', lead: 'LEAD-1', referenceDoctype: 'CRM Lead' })
    await flushPromises()

    await wrapper.find('input[placeholder="Task title"]').setValue('Call patient')
    await btn(wrapper, 'Create').trigger('click')
    await flushPromises()

    expect(ins.calls).toBe(1)
    expect(ins.payload.doc).toMatchObject({
      doctype: 'CRM Task',
      title: 'Call patient',
      status: 'Todo',
      priority: 'Low',
      custom_task_type: null,
      reference_doctype: 'CRM Lead',
      reference_docname: 'LEAD-1',
    })
    expect(wrapper.emitted('saved')[0]).toEqual(['TASK-NEW'])
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
  })

  it('saves an edited PLAIN task with frappe.client.set_value carrying the standard fields', async () => {
    mockFrappeMethod(TASK_DETAIL, {
      task: {
        name: 'TASK-9',
        title: 'Old title',
        status: 'Todo',
        priority: 'Low',
        description: '',
        assigned_to: '',
        task_type: '', // plain
        reference_doctype: 'CRM Lead',
        reference_docname: '',
        values: {},
      },
      config: null,
    })
    const sv = capture(SET_VALUE)
    const wrapper = mountModal({ mode: 'edit', task: { name: 'TASK-9' } })
    await flushPromises()

    await btn(wrapper, 'Save').trigger('click')
    await flushPromises()

    expect(sv.calls).toBe(1)
    expect(sv.payload).toMatchObject({ doctype: 'CRM Task', name: 'TASK-9' })
    expect(sv.payload.fieldname).toMatchObject({
      title: 'Old title',
      status: 'Todo',
      priority: 'Low',
      custom_task_type: null,
    })
  })

  it('gates the save with an inline error when a required schema field is empty (no write fires)', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    mockFrappeMethod(TYPE_CONFIG, BP_CONFIG)
    const ins = capture(INSERT, { name: 'X' })
    const comp = capture(COMPUTE, {})
    const wrapper = mountModal({ mode: 'create', lead: 'LEAD-1' })
    await flushPromises()

    // pick the typed activity -> its schema loads
    await pickType(wrapper, TYPE_PK)
    expect(wrapper.text()).toContain('Blood Pressure') // schema rendered

    await btn(wrapper, 'Log Activity').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Please fill: Blood Pressure')
    expect(comp.calls).toBe(0)
    expect(ins.calls).toBe(0)
    expect(wrapper.emitted('saved')).toBeFalsy()
  })

  it('saves a TYPED task through compute_activity_fields -> insert, sending the schema values', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    mockFrappeMethod(TYPE_CONFIG, BP_CONFIG)
    mockFrappeMethod(LOCATION_NEEDED, false) // type doesn't capture location -> no GPS path
    const comp = capture(COMPUTE, { custom_visit_done: 1 })
    const ins = capture(INSERT, { name: 'TASK-T' })
    const wrapper = mountModal({ mode: 'create', lead: 'LEAD-1' })
    await flushPromises()

    await pickType(wrapper, TYPE_PK)
    // the schema Data field is the second text input (title is the first)
    await wrapper.findAll('input[type="text"]')[1].setValue('120/80')

    await btn(wrapper, 'Log Activity').trigger('click')
    await flushPromises()

    // outbound: the raw schema values are computed server-side
    expect(comp.calls).toBe(1)
    expect(comp.payload).toMatchObject({ lead: 'LEAD-1', task_type: TYPE_PK })
    expect(JSON.parse(comp.payload.values)).toEqual({ bp: '120/80' })
    // then ONE native insert merges standard + type + computed fields
    expect(ins.calls).toBe(1)
    expect(ins.payload.doc).toMatchObject({
      doctype: 'CRM Task',
      custom_task_type: TYPE_PK,
      reference_doctype: 'CRM Lead',
      reference_docname: 'LEAD-1',
      custom_visit_done: 1, // from compute_activity_fields
    })
    expect(wrapper.emitted('saved')[0]).toEqual(['TASK-T'])
  })

  it('inline description media stages locally, uploads OWNED by the task on Save, and rewrites the description URL', async () => {
    const ins = capture(INSERT, { name: 'TASK-IMG' })
    const sv = capture(SET_VALUE)
    const wrapper = mountModal({ mode: 'create', lead: 'LEAD-1', referenceDoctype: 'CRM Lead' })
    await flushPromises()

    // the description editor's uploadFunction STAGES the image (no eager upload) and returns a local src
    const editor = wrapper.findComponent(TextEditorControlStub)
    const file = new File(['x'], 'shot.png', { type: 'image/png' })
    const staged = await editor.props('uploadFunction')(file)
    expect(staged.file_url).toBe('blob:mock-1')
    expect(uploadCalls.length).toBe(0)

    editor.vm.$emit('change', `<p><img src="${staged.file_url}"></p>`)
    await wrapper.find('input[placeholder="Task title"]').setValue('With image')
    await btn(wrapper, 'Create').trigger('click')
    await flushPromises()

    // plain-task insert first, still carrying the local src in the description
    expect(ins.calls).toBe(1)
    expect(ins.payload.doc.description).toBe('<p><img src="blob:mock-1"></p>')
    // the staged file is uploaded OWNED by the task
    expect(uploadCalls.length).toBe(1)
    expect(uploadCalls[0].name).toBe('shot.png')
    expect(uploadCalls[0].options).toMatchObject({
      doctype: 'CRM Task',
      docname: 'TASK-IMG',
      private: true,
    })
    // then the description is patched: local blob src -> owned proxy file_url
    expect(sv.calls).toBe(1)
    expect(sv.payload).toMatchObject({
      doctype: 'CRM Task',
      name: 'TASK-IMG',
      fieldname: { description: '<p><img src="/private/files/owned-shot.png"></p>' },
    })
  })

  it('emits update:modelValue false when Close is pressed in view mode', async () => {
    mockFrappeMethod(TASK_DETAIL, {
      task: { name: 'TASK-1', title: 'T', status: 'Todo', priority: 'Low', values: {} },
      config: null,
    })
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-1' } })
    await flushPromises()

    await btn(wrapper, 'Close').trigger('click')
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
  })
})
