// Purpose: TaskModal is the ONE native task modal (create / edit / view / log / complete). Its contract:
// on open it seeds standard CRM Task fields (create) or loads the full task via
// tatva_connect.activity.api.task_detail (edit/view); it scopes the Task Type picker to the lead via
// the grain-scoped tatva_connect.activity.api.list_types_for_lead resource (the composite `::` PK is the
// option VALUE, never visible text); picking a type loads THAT type's schema via type_config; Save writes
// through the right brain — a PLAIN task goes straight to frappe.client.insert / set_value, a TYPED task
// runs resolveLocation then ONE save_activity carrying both the answers and the standard fields the form
// drew, create and update alike (never a compute + insert, never a set_value beside it),
// and a missing required schema field gates the save with an inline error. Close emits update:modelValue
// false; a successful save emits 'saved' with the task name. Network is mocked at the boundary (MSW);
// outbound save payloads are captured with raw handlers. Heavy controls (Link/editor/pickers/map) and the
// teleporting ResponsiveDialog are stubbed so we test THIS component's logic, not theirs.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { Autocomplete, FormControl, toast } from 'frappe-ui'
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
const MAP_CONFIG = 'tatva_connect.location.api.map_config'
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
  fieldname: 'bp',
  label: 'Blood Pressure',
  fieldtype: 'Data',
  reqd: 1,
  depends_on: '',
  mandatory_depends_on: '',
  container_depends_on: [],
}
const BP_CONFIG = {
  fields: [BP_FIELD],
  tabs: [
    {
      key: 'tab-1',
      label: '',
      sections: [
        {
          key: 'section-2',
          label: '',
          columns: [{ key: 'column-3', label: '', fields: ['bp'] }],
        },
      ],
    },
  ],
  captures_location: false,
}

// The Document Verification shape: a status field, and a `notes` field homed at `description` that only
// three of the statuses show. `notes` is an ORDINARY declared field (D-G) — the modal renders its column
// with the rich editor instead of the schema control, but visibility is decided by the same compiled rule
// as every other field.
// Its own type PK, because type_config is cached by [type, lead] for the life of the module (B1/B2) —
// reusing TYPE_PK would serve this form the Blood Pressure schema an earlier test already cached.
const DV_TYPE_PK = 'ZZ Care::ZZ Group::ZZ Program::document_verification'
const DV_STATUS_FIELD = {
  fieldname: 'dv_status',
  label: 'Document Verification Status',
  fieldtype: 'Select',
  options: 'Verified\nRejected',
  reqd: 0,
  depends_on: '',
  mandatory_depends_on: '',
  container_depends_on: [],
}
const DV_NOTES_FIELD = {
  fieldname: 'notes',
  label: 'Notes',
  fieldtype: 'Small Text',
  reqd: 0,
  target: 'description',
  depends_on: 'eval:(doc.dv_status=="Verified")',
  mandatory_depends_on: '',
  container_depends_on: [],
}
const DV_CONFIG = {
  fields: [DV_STATUS_FIELD, DV_NOTES_FIELD],
  tabs: [
    {
      key: 'tab-1',
      label: '',
      sections: [
        {
          key: 'section-2',
          label: '',
          columns: [
            { key: 'column-3', label: '', fields: ['dv_status', 'notes'] },
          ],
        },
      ],
    },
  ],
  is_logged_complete: 1,
  captures_location: false,
}

// An existing typed task a rep is completing, parked on a status that HIDES notes while the task still
// carries a description (task_detail mirrors it back as `values.notes`, activity/api.py:_task_values).
const DV_TASK_DETAIL = {
  task: {
    name: 'TASK-DV',
    title: 'Document Verification',
    is_planned: 1,
    status: 'Todo',
    priority: 'Low',
    description: 'Aadhaar and prescription checked',
    assigned_to: 'rep@x.io',
    task_type: DV_TYPE_PK,
    reference_doctype: 'CRM Lead',
    reference_docname: 'LEAD-1',
    values: {
      dv_status: 'Rejected',
      notes: 'Aadhaar and prescription checked',
    },
  },
  config: DV_CONFIG,
}

// A type that DECLARES layout: two named sections, the second holding two columns, plus a rule that hides
// one field. This is the shape the read screen used to throw away — it printed every value in one flat
// grid with no headings and not in declared order. The tests below assert the declaration survives the
// read, which is the whole point of collapsing the two renderings into one.
const LAY_TYPE_PK = 'ZZ Care::ZZ Group::ZZ Program::order_punch'
const LAY_FIELDS = [
  {
    fieldname: 'outcome',
    label: 'Outcome',
    fieldtype: 'Select',
    options: 'Connected\nNot connected',
    reqd: 0,
    depends_on: '',
    mandatory_depends_on: '',
    container_depends_on: [],
  },
  // Shown only when the call connected — the branch that must stay branched on the read screen too.
  {
    fieldname: 'cycle',
    label: 'Cycle category',
    fieldtype: 'Data',
    reqd: 0,
    depends_on: 'eval:(doc.outcome=="Connected")',
    mandatory_depends_on: '',
    container_depends_on: [],
  },
  {
    fieldname: 'ref_no',
    label: 'Reference no',
    fieldtype: 'Data',
    reqd: 0,
    depends_on: '',
    mandatory_depends_on: '',
    container_depends_on: [],
  },
]
const LAY_CONFIG = {
  fields: LAY_FIELDS,
  tabs: [
    {
      key: 'tab-1',
      label: '',
      sections: [
        {
          key: 'sec-outcome',
          label: 'Call outcome',
          columns: [{ key: 'col-a', label: '', fields: ['outcome', 'cycle'] }],
        },
        {
          key: 'sec-order',
          label: 'Order',
          columns: [{ key: 'col-b', label: '', fields: ['ref_no'] }],
        },
      ],
    },
  ],
  captures_location: false,
}
const VISIT_TYPE_PK = 'ZZ Care::ZZ Group::ZZ Program::field_visit'
const LAY_TASK = (values, extra = {}) => ({
  task: {
    name: 'TASK-LAY',
    title: 'Order punch',
    is_planned: 1,
    status: 'Done',
    priority: 'Low',
    description: '',
    assigned_to: 'rep@x.io',
    task_type: LAY_TYPE_PK,
    reference_doctype: 'CRM Lead',
    reference_docname: 'LEAD-1',
    values,
    ...extra,
  },
  config: LAY_CONFIG,
})

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

const btn = (wrapper, label) =>
  wrapper.findAll('button').find((b) => b.text() === label)

// The locked form is asserted through the controls, not through printed text — that IS the change: there
// is no second read-only rendering to read words out of.
// Addressed by its declaration hook, not by its placeholder — a locked form carries no placeholder, which
// is the point of the lock.
const titleInput = (wrapper) => wrapper.find('[data-tc-std="title"] input')
// The picker's own control. The #target trigger Button cannot be reached here — the shared Popover stub
// renders only the default and `body` slots, not Autocomplete's `target` — but the search box inside the
// Autocomplete carries the `disabled` we passed it, which is the propagation worth asserting.
const pickerInput = (wrapper) => wrapper.find('[data-tc-typepicker] input')
const editorStub = (wrapper) => wrapper.findComponent(TextEditorControlStub)
// Every control the form owns, whatever kind: the real inputs plus the stubbed leaf controls that take a
// `disabled` prop. A lock that missed one of these would let a rep edit a field on a read-only screen.
const controlsOf = (wrapper) => {
  // The type picker owns its own internals (a search box inside its popover) whose disabled state is not
  // this form's to assert; its OWN lock is checked through the Autocomplete. Everything else is the form's.
  const picker = wrapper.find('[data-tc-typepicker]')
  const inPicker = (c) =>
    picker.exists() &&
    picker.element.contains(c.element) &&
    c.element !== picker.element
  return [
    FormControl,
    TextEditorControlStub,
    { name: 'Link' },
    { name: 'AttachControl' },
    { name: 'DateTimePicker' },
    { name: 'DatePicker' },
  ]
    .flatMap((c) => wrapper.findAllComponents(c))
    .filter((c) => !inPicker(c))
}
// The stubs declare no `disabled` prop, so it arrives as a fall-through attribute; the real FormControl
// passes it the same way (which is why mvOf reads $attrs too). Ask both, in that order.
const isDisabled = (c) =>
  Boolean(c.vm?.$attrs?.disabled ?? c.props?.('disabled'))
const allDisabled = (wrapper) => {
  const cs = controlsOf(wrapper)
  return cs.length > 0 && cs.every(isDisabled)
}
const noneDisabled = (wrapper) => {
  const cs = controlsOf(wrapper)
  return cs.length > 0 && cs.every((c) => !isDisabled(c))
}
// Section headings that are actually ON SCREEN, in DOM order. Sections are hidden with v-show (never
// filtered out), so the hidden ones are present and must be excluded by their inline display.
const sectionHeadings = (wrapper) =>
  wrapper
    .findAll('[data-tc-section]')
    .filter((el) => el.element.style.display !== 'none')
    .map((el) => el.find('.font-semibold'))
    .filter((el) => el.exists())
    .map((el) => el.text())

// FormControl type="select" renders a reka teleporting combobox (no native <select>). `options`/
// `modelValue` fall through to $attrs (not declared props), so read them off vm.$attrs; identify each
// control by its options and drive its v-model via the FormControl's update:modelValue emit (invariant 4).
const fcs = (wrapper) => wrapper.findAllComponents(FormControl)
const optsOf = (fc) => fc.vm.$attrs.options || []
const mvOf = (fc) => fc.vm.$attrs.modelValue
const statusFc = (wrapper) =>
  fcs(wrapper).find((fc) => optsOf(fc).includes?.('In Progress'))
const priorityFc = (wrapper) =>
  fcs(wrapper).find((fc) => optsOf(fc).includes?.('Medium'))
// The type picker is an Autocomplete driven the house way (GroupBy.vue / SortBy.vue): a plain `value` and
// an `@change` carrying the chosen option, on the component's own target. It is NOT a FormControl select
// and carries no blank first option, so it is found and driven as the component it is.
const typeAc = (wrapper) => wrapper.findComponent(Autocomplete)
// The type slot is on the form in EVERY state; what a row that already names a type loses is the CHOICE.
const typeSlot = (wrapper) => wrapper.find('[data-tc-typepicker]')
const typeIsPickable = (wrapper) => typeAc(wrapper).exists()
// A new plan is refused without a time. These tests are about the save PAYLOAD, so they schedule first,
// through the picker's own @change — the same event the real DateTimePicker emits.
const setDue = async (wrapper, when = '2026-08-09 11:00:00') => {
  wrapper.findComponent({ name: 'DateTimePicker' }).vm.$emit('change', when)
  await flushPromises()
}
const pickType = async (wrapper, pk) => {
  typeAc(wrapper).vm.$emit('change', { value: pk })
  await flushPromises()
}

let blobSeq = 0
beforeEach(() => {
  vi.spyOn(toast, 'error').mockImplementation(() => {})
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
    expect(titleInput(wrapper).exists()).toBe(true)
    expect(mvOf(statusFc(wrapper))).toBe('Todo')
    expect(mvOf(priorityFc(wrapper))).toBe('Low')
    // status select carries the full STATUS_OPTIONS set
    expect(optsOf(statusFc(wrapper))).toEqual([
      'Backlog',
      'Todo',
      'In Progress',
      'Done',
      'Canceled',
    ])
  })

  it('loads the full task via task_detail in view mode and renders the SAME form, locked', async () => {
    mockFrappeMethod(TASK_DETAIL, {
      task: {
        name: 'TASK-1',
        title: 'Follow up with patient',
        status: 'In Progress',
        priority: 'High',
        description: 'Call before noon',
        assigned_to: 'rep@x.io',
        due_date: '2026-08-09 11:00:00',
        is_planned: 1,
        reference_doctype: 'CRM Lead',
        reference_docname: '',
        values: {},
      },
      config: null,
    })
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-1' } })
    await flushPromises()

    // The values are IN the controls now, not printed as text: reading a task is the same form with the
    // controls shut, so the title is an input's value and the description is the editor's.
    expect(titleInput(wrapper).element.value).toBe('Follow up with patient')
    expect(mvOf(priorityFc(wrapper))).toBe('High')
    expect(editorStub(wrapper).props('value')).toBe('Call before noon')
    // The header wears ONE state pill — how the row stands against its own clock while it is open. The
    // status is a field like every other, muted, never a second badge saying a second thing at the top.
    expect(wrapper.find('[data-tc-facts]').text()).toContain('Overdue')
    expect(mvOf(statusFc(wrapper))).toBe('In Progress')

    // Locked: every control refuses input until Edit is pressed.
    expect(allDisabled(wrapper)).toBe(true)

    // view mode shows Edit / Close, not the editable Save
    expect(btn(wrapper, 'Edit')).toBeTruthy()
    expect(btn(wrapper, 'Close')).toBeTruthy()
    expect(btn(wrapper, 'Save')).toBeFalsy()
  })

  it('populates the Task Type picker from list_types_for_lead, showing the label and never the :: PK', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    const wrapper = mountModal({ mode: 'create', lead: 'LEAD-1' })
    await flushPromises()

    const options = typeAc(wrapper).props('options')
    const opt = options.find((o) => o.label === 'Doctor Visit') // human label
    expect(opt).toBeTruthy()
    expect(opt.value).toBe(TYPE_PK) // composite PK is the VALUE the server expects
    // no option exposes the :: PK as its visible label
    expect(options.every((o) => !/::/.test(o.label))).toBe(true)
  })

  it('saves a PLAIN task with frappe.client.insert and emits saved + closes', async () => {
    const ins = capture(INSERT, { name: 'TASK-NEW' })
    const wrapper = mountModal({
      mode: 'create',
      lead: 'LEAD-1',
      referenceDoctype: 'CRM Lead',
    })
    await flushPromises()

    await titleInput(wrapper).setValue('Call patient')
    await setDue(wrapper)
    await btn(wrapper, 'Create').trigger('click')
    await flushPromises()

    expect(ins.calls).toBe(1)
    expect(ins.payload.doc).toMatchObject({
      doctype: 'CRM Task',
      title: 'Call patient',
      status: 'Todo',
      priority: 'Low',
      due_date: '2026-08-09 11:00:00',
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
    const wrapper = mountModal({
      mode: 'create',
      lead: 'LEAD-1',
      defaultType: TYPE_PK,
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Blood Pressure') // schema rendered

    await btn(wrapper, 'Log Activity').trigger('click')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Please fill: Blood Pressure')
    expect(comp.calls).toBe(0)
    expect(ins.calls).toBe(0)
    expect(wrapper.emitted('saved')).toBeFalsy()
  })

  // ---- CREATING a typed activity is ONE write too ------------------------------------------------
  // It was two: compute_activity_fields, then frappe.client.insert carrying what the server had just
  // computed. Two requests means two transactions — a location-tracked grain committed its anchor and an
  // "Accepted" visit-audit row in the first, and a failure in the second left that visit pointing at no
  // task at all. `save_activity` with no `task` is the same ad-hoc punch door the partner API uses.

  it('creates a TYPED task through ONE save_activity, never compute + insert', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    mockFrappeMethod(TYPE_CONFIG, BP_CONFIG)
    mockFrappeMethod(LOCATION_NEEDED, false) // type doesn't capture location -> no GPS path
    const comp = capture(COMPUTE, { custom_visit_done: 1 })
    const ins = capture(INSERT, { name: 'TASK-T' })
    const sa = capture(SAVE_ACTIVITY, 'TASK-T')
    const wrapper = mountModal({
      mode: 'create',
      lead: 'LEAD-1',
      defaultType: TYPE_PK,
    })
    await flushPromises()

    // Addressed by its declaration, never by ordinal: the type picker is an Autocomplete and renders a
    // search input of its own, so "the second text input" is not the schema field.
    await wrapper.find('[data-tc-field="bp"] input').setValue('120/80')

    await btn(wrapper, 'Log Activity').trigger('click')
    await flushPromises()

    expect(comp.calls).toBe(0) // the client no longer computes, then asserts what it was told
    expect(ins.calls).toBe(0) // ...nor hand-assembles the row
    expect(sa.calls).toBe(1)
    expect(sa.payload).toMatchObject({ lead: 'LEAD-1', task_type: TYPE_PK })
    expect(sa.payload.task).toBeFalsy() // no task yet — this is the create form
    expect(JSON.parse(sa.payload.values)).toEqual({ bp: '120/80' })
    expect(wrapper.emitted('saved')[0]).toEqual(['TASK-T'])
  })

  it('never asserts an assignee the log form did not draw, so the server can name the rep', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    mockFrappeMethod(TYPE_CONFIG, BP_CONFIG)
    mockFrappeMethod(LOCATION_NEEDED, false)
    const sa = capture(SAVE_ACTIVITY, 'TASK-T')
    const wrapper = mountModal({
      mode: 'create',
      lead: 'LEAD-1',
      defaultType: TYPE_PK,
    })
    await flushPromises()
    await wrapper.find('[data-tc-field="bp"] input').setValue('120/80')

    await btn(wrapper, 'Log Activity').trigger('click')
    await flushPromises()

    // A log draws no assignee control, so the form has no answer to give. Sending the blank it never asked
    // for lands in the same `doc.update` AFTER the server set the rep (activity/api.py:1026-1030) and
    // clobbers them back to nobody.
    const fields = JSON.parse(sa.payload.task_fields)
    expect('assigned_to' in fields).toBe(false)
    expect(fields).toMatchObject({ title: 'Doctor Visit' })
  })

  it('sends the assignee of a task that HAS an appointment', async () => {
    mockFrappeMethod(TASK_DETAIL, DV_TASK_DETAIL)
    mockFrappeMethod(TYPE_CONFIG, DV_CONFIG)
    mockFrappeMethod(LOCATION_NEEDED, false)
    const sa = capture(SAVE_ACTIVITY, 'TASK-DV')
    const wrapper = mountModal({
      mode: 'complete',
      lead: 'LEAD-1',
      task: { name: 'TASK-DV' },
    })
    await flushPromises()

    await btn(wrapper, 'Save').trigger('click')
    await flushPromises()

    expect(JSON.parse(sa.payload.task_fields)).toMatchObject({
      assigned_to: 'rep@x.io',
    })
  })

  it('inline description media stages locally, uploads OWNED by the task on Save, and rewrites the description URL', async () => {
    const ins = capture(INSERT, { name: 'TASK-IMG' })
    const sv = capture(SET_VALUE)
    const wrapper = mountModal({
      mode: 'create',
      lead: 'LEAD-1',
      referenceDoctype: 'CRM Lead',
    })
    await flushPromises()

    // the description editor's uploadFunction STAGES the image (no eager upload) and returns a local src
    const editor = wrapper.findComponent(TextEditorControlStub)
    const file = new File(['x'], 'shot.png', { type: 'image/png' })
    const staged = await editor.props('uploadFunction')(file)
    expect(staged.file_url).toBe('blob:mock-1')
    expect(uploadCalls.length).toBe(0)

    editor.vm.$emit('change', `<p><img src="${staged.file_url}"></p>`)
    await titleInput(wrapper).setValue('With image')
    await setDue(wrapper)
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
      fieldname: {
        description: '<p><img src="/private/files/owned-shot.png"></p>',
      },
    })
  })

  // ---- completing an EXISTING typed task is ONE write --------------------------------------------
  // It was two: frappe.client.set_value with the standard fields, then save_activity with the answers.
  // That fork committed `status: Done` before a single answer existed, so the server's logged-activity
  // backstop refused the rep who had just filled the form; and every later refusal left the task
  // half-updated, because the standard edits were already in.

  it('completes an existing typed task with ONE save_activity carrying the standard fields, never a set_value beside it', async () => {
    mockFrappeMethod(TASK_DETAIL, DV_TASK_DETAIL)
    mockFrappeMethod(TYPE_CONFIG, DV_CONFIG)
    mockFrappeMethod(LOCATION_NEEDED, false)
    const sv = capture(SET_VALUE)
    const sa = capture(SAVE_ACTIVITY, 'TASK-DV')
    const wrapper = mountModal({
      mode: 'complete',
      lead: 'LEAD-1',
      task: { name: 'TASK-DV' },
    })
    await flushPromises()

    await btn(wrapper, 'Save').trigger('click')
    await flushPromises()

    expect(sv.calls).toBe(0) // the second write is gone
    expect(sa.calls).toBe(1)
    expect(sa.payload).toMatchObject({
      lead: 'LEAD-1',
      task_type: DV_TYPE_PK,
      task: 'TASK-DV',
    })
    // the standard fields ride the SAME call, so status + answers land in one save and one transaction
    expect(JSON.parse(sa.payload.task_fields)).toMatchObject({
      title: 'Document Verification',
      description: 'Aadhaar and prescription checked',
      status: 'Done',
      priority: 'Low',
    })
    expect(wrapper.emitted('saved')[0]).toEqual(['TASK-DV'])
  })

  it('never submits a `notes` a rule has hidden, even though the description editor filled it', async () => {
    mockFrappeMethod(TASK_DETAIL, DV_TASK_DETAIL)
    mockFrappeMethod(TYPE_CONFIG, DV_CONFIG)
    mockFrappeMethod(LOCATION_NEEDED, false)
    capture(SET_VALUE)
    const sa = capture(SAVE_ACTIVITY, 'TASK-DV')
    const wrapper = mountModal({
      mode: 'complete',
      lead: 'LEAD-1',
      task: { name: 'TASK-DV' },
    })
    await flushPromises()

    await btn(wrapper, 'Save').trigger('click')
    await flushPromises()

    // `dv_status: Rejected` hides notes, so only the shown field is submitted — the server refuses a
    // value for a question the rep was never asked, which made 4 of the 7 statuses unsaveable here.
    expect(JSON.parse(sa.payload.values)).toEqual({ dv_status: 'Rejected' })
    // and the description is NOT lost: it rides the standard fields instead.
    expect(JSON.parse(sa.payload.task_fields).description).toBe(
      'Aadhaar and prescription checked',
    )
  })

  it('DOES submit `notes` at a status that shows it', async () => {
    const shown = {
      ...DV_TASK_DETAIL,
      task: {
        ...DV_TASK_DETAIL.task,
        values: { ...DV_TASK_DETAIL.task.values, dv_status: 'Verified' },
      },
    }
    mockFrappeMethod(TASK_DETAIL, shown)
    mockFrappeMethod(TYPE_CONFIG, DV_CONFIG)
    mockFrappeMethod(LOCATION_NEEDED, false)
    capture(SET_VALUE)
    const sa = capture(SAVE_ACTIVITY, 'TASK-DV')
    const wrapper = mountModal({
      mode: 'complete',
      lead: 'LEAD-1',
      task: { name: 'TASK-DV' },
    })
    await flushPromises()

    await btn(wrapper, 'Save').trigger('click')
    await flushPromises()

    // The other direction, so "drop notes" can never pass by dropping it always.
    expect(JSON.parse(sa.payload.values)).toEqual({
      dv_status: 'Verified',
      notes: 'Aadhaar and prescription checked',
    })
  })

  // ---------------------------------------------------------------------------------------------------
  // Reading a task = the SAME form, locked. These are the tests that would have caught the flat read
  // screen: they assert the DECLARATION reaches the read surface, not just that the values are somewhere.
  // ---------------------------------------------------------------------------------------------------

  it('renders the declared sections, in declared order, when READING a task', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({ outcome: 'Connected', cycle: 'Paid', ref_no: 'RX-9' }),
    )
    // loadSchema re-reads the config from type_config and OVERWRITES what task_detail carried, emptying it on a failed fetch — so a typed fixture must mock BOTH doors.
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    // The old read screen printed values in one unheaded grid; these headings are the regression.
    expect(sectionHeadings(wrapper)).toEqual(['Call outcome', 'Order'])
  })

  it('honours a hide rule while READING, not just while editing', async () => {
    // outcome is "Not connected", so `cycle` is hidden by its depends_on — on the read screen too.
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({ outcome: 'Not connected', cycle: 'Paid', ref_no: 'RX-9' }),
    )
    // loadSchema re-reads the config from type_config and OVERWRITES what task_detail carried, emptying it on a failed fetch — so a typed fixture must mock BOTH doors.
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    const cycle = wrapper.find('[data-tc-field="cycle"]')
    expect(cycle.exists()).toBe(true) // mounted, never filtered out
    expect(cycle.element.style.display).toBe('none') // and hidden by the same compiled rule
    expect(
      wrapper.find('[data-tc-field="outcome"]').element.style.display,
    ).not.toBe('none')
  })

  it('locks every control while reading and unlocks them all on Edit', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({ outcome: 'Connected', cycle: 'Paid', ref_no: 'RX-9' }),
    )
    // loadSchema re-reads the config from type_config and OVERWRITES what task_detail carried, emptying it on a failed fetch — so a typed fixture must mock BOTH doors.
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    expect(allDisabled(wrapper)).toBe(true)
    // The type is on the form, naming itself, with no choice attached.
    expect(typeSlot(wrapper).exists()).toBe(true)
    expect(typeIsPickable(wrapper)).toBe(false)

    await btn(wrapper, 'Edit').trigger('click')
    await flushPromises()

    expect(noneDisabled(wrapper)).toBe(true)
    // ...and it is STILL there, still muted, with the form open: an existing task's type is a fact, and the
    // answers on screen belong to it. A field that vanished between two states of one form is unlearnable.
    expect(typeSlot(wrapper).exists()).toBe(true)
    expect(typeIsPickable(wrapper)).toBe(false)
    expect(btn(wrapper, 'Save')).toBeTruthy()
  })

  it('a migrated task NAMES its type even when the lead can no longer be given it', async () => {
    // The row the LSQ load leaves behind: a type the grain has since stopped offering, so
    // `list_types_for_lead` cannot label it and only the row's own `task_type_label` can.
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({ outcome: 'Connected' }, { task_type_label: 'Order Punch' }),
    )
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    mockFrappeMethod(LIST_TYPES, [])
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    // Its own label, in the field and in the header — never the `::` composite key, and never a blank.
    expect(mvOf(typeSlot(wrapper).findComponent(FormControl))).toBe(
      'Order Punch',
    )
    expect(wrapper.find('[data-tc-facts]').text()).toContain('Order Punch')
    expect(wrapper.text()).not.toContain('::')
  })

  it('Cancel puts the abandoned edit BACK, instead of leaving it on screen as though it saved', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({ outcome: 'Connected', cycle: 'Paid', ref_no: 'RX-9' }),
    )
    // loadSchema re-reads the config from type_config and OVERWRITES what task_detail carried, emptying it on a failed fetch — so a typed fixture must mock BOTH doors.
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    await btn(wrapper, 'Edit').trigger('click')
    await flushPromises()

    // Change one appointment field and one record field, then walk away.
    priorityFc(wrapper).vm.$emit('update:modelValue', 'High')
    const refNo = wrapper.find('[data-tc-field="ref_no"] input')
    await refNo.setValue('EDITED-NOT-SAVED')
    await flushPromises()

    await btn(wrapper, 'Cancel').trigger('click')
    await flushPromises()

    // Back to reading, showing what is actually stored — not the abandoned edit.
    expect(allDisabled(wrapper)).toBe(true)
    expect(mvOf(priorityFc(wrapper))).toBe('Low')
    expect(wrapper.find('[data-tc-field="ref_no"] input').element.value).toBe(
      'RX-9',
    )
  })

  it('shows the captured location when reading a visit that recorded one', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK(
        { outcome: 'Connected', ref_no: 'RX-9' },
        {
          location: { lat: 12.9, lng: 77.6, address: '4th Block, Jayanagar' },
        },
      ),
    )
    // loadSchema re-reads the config from type_config and OVERWRITES what task_detail carried, emptying it on a failed fetch — so a typed fixture must mock BOTH doors.
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    // The map is drawn only once the shared map config lands (`v-if="mapConfig"`) — a module-level ref
    // fetched lazily by the first surface that needs a map, so it must answer here or no map is drawn.
    mockFrappeMethod(MAP_CONFIG, {
      zoom: 15,
      thumbnail: 'osm',
      tile_url: 'https://tile/{z}/{x}/{y}.png',
    })
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()
    await flushPromises()

    expect(wrapper.text()).toContain('4th Block, Jayanagar')
    expect(wrapper.findComponent({ name: 'TatvaMiniMap' }).exists()).toBe(true)
  })

  it('says so when a location-capturing type recorded NO location', async () => {
    // Its OWN type PK: type_config is memoised per [type, lead] for the life of the module, so reusing
    // LAY_TYPE_PK would serve this form the captures_location=0 config an earlier test already cached.
    const detail = LAY_TASK({ outcome: 'Connected', ref_no: 'RX-9' })
    detail.task.task_type = VISIT_TYPE_PK
    mockFrappeMethod(TASK_DETAIL, {
      ...detail,
      config: { ...LAY_CONFIG, captures_location: true },
    })
    mockFrappeMethod(TYPE_CONFIG, { ...LAY_CONFIG, captures_location: true })
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    // Silence would read as "a location was never asked for", which is the opposite of true here.
    expect(wrapper.text()).toContain('No location was captured')
    expect(wrapper.findComponent({ name: 'TatvaMiniMap' }).exists()).toBe(false)
  })

  it('never offers the "pick a type" placeholder on a locked form', async () => {
    mockFrappeMethod(TASK_DETAIL, {
      task: {
        name: 'TASK-1',
        title: 'Plain',
        status: 'Todo',
        priority: 'Low',
        is_planned: 1,
        values: {},
      },
      config: null,
    })
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-1' } })
    await flushPromises()

    // A plain task read back has no schema, no location and no picker to send anyone to.
    expect(wrapper.text()).not.toContain(
      'Select a task type to display its fields',
    )
  })

  it('shows the captured location above the questions, never at the foot of a long declared form', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK(
        { outcome: 'Connected', ref_no: 'RX-9' },
        { location: { lat: 12.9, lng: 77.6, address: '4th Block, Jayanagar' } },
      ),
    )
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    mockFrappeMethod(MAP_CONFIG, {
      zoom: 15,
      thumbnail: 'osm',
      tile_url: 'https://tile/{z}/{x}/{y}.png',
    })
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()
    await flushPromises()

    // Location is a fact of the visit, so it sits with the other settled facts ABOVE the questions, where
    // it cannot be clipped off the bottom of a long declared form.
    const map = wrapper.findComponent({ name: 'TatvaMiniMap' })
    expect(map.exists()).toBe(true)
    const answers = wrapper.find('[data-tc-tab]')
    expect(answers.exists()).toBe(true)
    expect(
      map.element.compareDocumentPosition(answers.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('never advertises an action on a locked control', async () => {
    mockFrappeMethod(TASK_DETAIL, {
      task: {
        name: 'TASK-1',
        title: 'Plain',
        status: 'Todo',
        priority: 'Low',
        is_planned: 1,
        values: {},
      },
      config: null,
    })
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-1' } })
    await flushPromises()

    // "Assign to…" / "Select date & time" on a screen that refuses input reads as something to click. An
    // empty locked control reads "—" instead: several frappe-ui controls fall back to their own default
    // on an empty string, so a dash is the only thing that can actually be shown.
    for (const c of controlsOf(wrapper)) {
      const ph = c.vm?.$attrs?.placeholder ?? c.props?.('placeholder') ?? '—'
      expect(ph).toBe('—')
    }
    // ...and an untyped task says so rather than inviting a choice it will not accept.
    expect(wrapper.text()).not.toContain('Select a task type')

    await btn(wrapper, 'Edit').trigger('click')
    await flushPromises()
    // Open the form and the prompts come back. This row names no type, so it still offers the picker —
    // that is how a bare reminder becomes a logged activity, and there are no answers for it to contradict.
    expect(titleInput(wrapper).attributes('placeholder')).toBe('Task title')
    expect(wrapper.find('[data-tc-typepicker]').exists()).toBe(true)
  })

  it('is ONE column with ONE scrollbar — a plan and a punch are never side by side', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({ outcome: 'Connected', ref_no: 'RX-9' }),
    )
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    // The split is gone, and with it the nested scroll regions it needed. One capped body, one scrollbar.
    expect(wrapper.find('.lg\\:flex-row').exists()).toBe(false)
    expect(wrapper.find('.lg\\:overflow-y-auto').exists()).toBe(false)
    // Capped-and-unscrollable is what clipped the save error out of sight, so `lg:overflow-hidden` must
    // never come back beside the `sm:` cap.
    expect(wrapper.find('.lg\\:overflow-hidden').exists()).toBe(false)
    // ...and the one capped box still owns its scrollbar, with room for the focus ring it clips otherwise.
    const body = wrapper.find('[data-tc-body]')
    expect(body.classes()).toContain('overflow-y-auto')
    expect(body.classes()).toContain('p-1')
    // ...and the header is OUTSIDE it, which is the whole of the pin: a strip inside the capped box scrolls
    // away the moment a rep reaches the answers, taking the type and the due state off screen with it.
    expect(body.element.contains(wrapper.find('[data-tc-facts]').element)).toBe(
      false,
    )
    // The cap is `sm:` only, so below it the sheet owns the scroll and the strip rides with the content — one scroller on a phone, before and after.
    expect(body.classes().join(' ')).not.toMatch(/(^|\s)max-h-/)
  })

  it('completing a promised task shows BOTH halves — the promise it is keeping, and the record it is filling', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({ outcome: 'Connected', ref_no: 'RX-9' }),
    )
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    const wrapper = mountModal({ mode: 'complete', task: { name: 'TASK-LAY' } })
    await flushPromises()

    expect(wrapper.find('[data-tc-facts]').exists()).toBe(true)
    expect(wrapper.find('[data-tc-appointment]').exists()).toBe(true)
    expect(wrapper.find('[data-tc-record]').exists()).toBe(true)
    // The type is a fact of an existing row: shown, muted, with no choice attached.
    expect(typeSlot(wrapper).exists()).toBe(true)
    expect(typeIsPickable(wrapper)).toBe(false)
    expect(wrapper.find('[data-tc-field="outcome"]').exists()).toBe(true)
    expect(noneDisabled(wrapper)).toBe(true)
    expect(btn(wrapper, 'Save')).toBeTruthy()
  })

  // ---- APPOINTMENT and RECORD ---------------------------------------------------------------------
  // A row is born an appointment (someone promised it) or a record (someone logged what they did). The
  // server stamps which at insert (`is_planned`); the form shows the scheduling half iff it is set. There
  // is no third arrangement, no mode, and nothing is re-derived from the type.

  it('a LOG carries no appointment — nothing scheduled it, so no scheduling is shown or offered', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    mockFrappeMethod(TYPE_CONFIG, BP_CONFIG)
    const wrapper = mountModal({
      mode: 'create',
      lead: 'LEAD-1',
      defaultType: TYPE_PK,
    })
    await flushPromises()

    expect(wrapper.find('[data-tc-appointment]').exists()).toBe(false)
    expect(wrapper.find('[data-tc-details-toggle]').exists()).toBe(false) // no side door either
    expect(statusFc(wrapper)).toBeUndefined()
    expect(priorityFc(wrapper)).toBeUndefined()
    expect(titleInput(wrapper).exists()).toBe(false)
    // ...and no facts line either: there is no row yet, so there is no status to state.
    expect(wrapper.find('[data-tc-facts]').exists()).toBe(false)
  })

  it('an existing PLANNED task shows its appointment, in view and in edit alike', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({ outcome: 'Connected' }, { is_planned: 1 }),
    )
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    expect(wrapper.find('[data-tc-appointment]').exists()).toBe(true)
    expect(wrapper.find('[data-tc-field="outcome"]').exists()).toBe(true) // and its record half
    await btn(wrapper, 'Edit').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-tc-appointment]').exists()).toBe(true)
    expect(priorityFc(wrapper)).toBeTruthy() // openly, never behind a disclosure
    expect(wrapper.find('[data-tc-details-toggle]').exists()).toBe(false)
  })

  it('an existing LOG never grows an appointment, however it is opened', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({ outcome: 'Connected' }, { is_planned: 0 }),
    )
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    expect(wrapper.find('[data-tc-appointment]').exists()).toBe(false)
    await btn(wrapper, 'Edit').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-tc-appointment]').exists()).toBe(false)
    expect(wrapper.find('[data-tc-field="outcome"]').exists()).toBe(true)
  })

  it('states each row by its OWN clock — a promise by when it is due, a record by when it was logged', async () => {
    mockFrappeMethod(
      TASK_DETAIL,
      LAY_TASK({}, { is_planned: 0, creation: '2026-08-06 16:10:00' }),
    )
    mockFrappeMethod(TYPE_CONFIG, LAY_CONFIG)
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-LAY' } })
    await flushPromises()

    // Absent today: a log showed no time at all, so a rep reading one could not tell when it happened.
    const facts = wrapper.find('[data-tc-facts]').text()
    expect(facts).toContain('Logged')
    expect(facts).not.toContain('Due')
  })

  it('refuses to create a plan with no time — an appointment without one is not an appointment', async () => {
    const ins = capture(INSERT, { name: 'TASK-P' })
    const wrapper = mountModal({ mode: 'create', lead: 'LEAD-1' })
    await flushPromises()

    await btn(wrapper, 'Create').trigger('click')
    await flushPromises()

    expect(ins.calls).toBe(0)
    expect(toast.error).toHaveBeenCalled()
    expect(toast.error.mock.calls.at(-1)[0]).toMatch(/due date/i)
  })

  it('Log Activity asks the questions and nothing else — one column, no scheduling', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    mockFrappeMethod(TYPE_CONFIG, BP_CONFIG)
    const wrapper = mountModal({
      mode: 'create',
      lead: 'LEAD-1',
      defaultType: TYPE_PK,
    })
    await flushPromises()

    // A log records what already happened, so there is nothing to schedule and no plan to show beside it:
    // the answers are the whole modal. Title is absent because a log is named after its own type.
    expect(wrapper.find('[data-tc-field="bp"]').exists()).toBe(true)
    expect(titleInput(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-tc-typepicker]').exists()).toBe(false)
    expect(wrapper.find('.lg\\:flex-row').exists()).toBe(false) // one column, so no split
    expect(noneDisabled(wrapper)).toBe(true)
    expect(btn(wrapper, 'Log Activity')).toBeTruthy()
  })

  it('New Task plans and never asks the questions, even once a type is picked', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    mockFrappeMethod(TYPE_CONFIG, BP_CONFIG)
    const wrapper = mountModal({ mode: 'create', lead: 'LEAD-1' })
    await flushPromises()
    await pickType(wrapper, TYPE_PK)

    // Picking a type on a PLAN says which kind of work is being scheduled — it does not mean the visit
    // happened. Automation's own Create Task raises exactly this: a shell with a due date and no answers.
    expect(titleInput(wrapper).exists()).toBe(true)
    expect(wrapper.find('[data-tc-field="bp"]').exists()).toBe(false)
    expect(wrapper.find('.lg\\:flex-row').exists()).toBe(false)
    expect(btn(wrapper, 'Create')).toBeTruthy()
    expect(btn(wrapper, 'Log Activity')).toBeFalsy()
  })
  // ---- a refused save says what the rep can act on ------------------------------------------------

  it('names the location as the problem when the location probe itself fails, instead of saving blind', async () => {
    mockFrappeMethod(LIST_TYPES, TYPES)
    mockFrappeMethod(TYPE_CONFIG, BP_CONFIG)
    server.use(
      http.post(`*/api/method/${LOCATION_NEEDED}`, () =>
        HttpResponse.json({ message: null }, { status: 500 }),
      ),
    )
    const sa = capture(SAVE_ACTIVITY, 'TASK-T')
    const wrapper = mountModal({
      mode: 'create',
      lead: 'LEAD-1',
      defaultType: TYPE_PK,
    })
    await flushPromises()
    await wrapper.find('[data-tc-field="bp"] input').setValue('120/80')

    await btn(wrapper, 'Log Activity').trigger('click')
    await flushPromises()

    // Swallowed, this saved with no fix, the server refused it for a missing location, and the rep read
    // "Could not save — please try again" — never the one thing they could have fixed.
    expect(sa.calls).toBe(0)
    expect(toast.error).toHaveBeenCalled()
    expect(toast.error.mock.calls.at(-1)[0]).toMatch(/location/i)
  })

  it('closes rather than paint an empty New Task over a task it could not load', async () => {
    server.use(
      http.post(`*/api/method/${TASK_DETAIL}`, () =>
        HttpResponse.json({ message: null }, { status: 500 }),
      ),
    )
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-GONE' } })
    await flushPromises()

    expect(toast.error).toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
  })

  it('emits update:modelValue false when Close is pressed in view mode', async () => {
    mockFrappeMethod(TASK_DETAIL, {
      task: {
        name: 'TASK-1',
        title: 'T',
        status: 'Todo',
        priority: 'Low',
        values: {},
      },
      config: null,
    })
    const wrapper = mountModal({ mode: 'view', task: { name: 'TASK-1' } })
    await flushPromises()

    await btn(wrapper, 'Close').trigger('click')
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
  })
})
