// Purpose: SmartViewEditor is the create/edit authoring modal for a Smart View. Its children
// (ConditionBuilder predicate, ColumnManager columns, the grain picker) each have their own specs, so
// this pins ONLY what the editor adds on top of them: (1) seeding a blank draft on open-create vs
// rehydrating every field from get_view on open-edit (including filtering stale column keys to the
// loaded catalog), (2) the OUTBOUND save payload to upsert_view — the exact {label, base_object,
// grain axes, predicate tree, columns} contract the backend persists, (3) the step/grain validation
// gates that block a save, and (4) the close + 'saved'/'deleted' emit contract. Network is mocked at
// the boundary (MSW); the heavy builders are stubbed and driven via update:modelValue so we test THIS
// component's assembly, not theirs.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { FormControl } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod, server, http, HttpResponse } from './_msw.js'

// createDialog opens a teleported native confirm dialog (overlay, not this component's contract) — mock
// it so we can invoke its action directly, mirroring how NotificationsSettings mocks '@/tatva/push'.
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
import { createDialog } from '@/utils/dialogs'

import SmartViewEditor from '@/tatva/SmartViewEditor.vue'

// --- method endpoints ------------------------------------------------------
const GETLIST = 'frappe.client.get_list' // CRM Task Type (activity types)
const GRAINS = 'tatva_connect.access.entitlement.my_entitled_grains'
const CATALOG_M = 'tatva_connect.smartview.api.field_catalog'
const GETVIEW = 'tatva_connect.smartview.api.get_view'
const UPSERT = 'tatva_connect.smartview.api.upsert_view'
const DELETE = 'tatva_connect.smartview.api.delete_view'

// field_catalog rows: field_key IS the identifier the predicate/columns reference.
const CATALOG = [
  { field_key: 'status', label: 'Status', fieldtype: 'Select', options: 'Open\nClosed', filterable: true },
  { field_key: 'lead_name', label: 'Name', fieldtype: 'Data', filterable: true },
  { field_key: 'mobile_no', label: 'Mobile', fieldtype: 'Data', filterable: false },
]

// grain entitlement shapes (the same brain the server validates against)
const GRAIN_ALL = { all: true, grains: [] }
const GRAIN_ONE = { all: false, grains: [{ vertical: 'GoodFlip', group: 'Anaya', program: 'Nivolumab' }] }
const GRAIN_MANY = {
  all: false,
  grains: [
    { vertical: 'GoodFlip', group: 'Anaya', program: 'Nivolumab' },
    { vertical: 'GoodFlip', group: 'Bhavna', program: 'Keytruda' },
  ],
}

const PRED = { op: 'and', conditions: [{ field: 'status', operator: '=', value: 'Open' }] }
const COLS = ['status', 'lead_name']

// Stub the builders: they own their own specs. We drive update:modelValue to feed the editor a
// predicate/column set without rebuilding them.
const ConditionBuilderStub = {
  name: 'ConditionBuilder',
  props: { modelValue: { default: null }, fields: { default: () => [] } },
  emits: ['update:modelValue'],
  template: '<div data-stub="cb" />',
}
const ColumnManagerStub = {
  name: 'ColumnManager',
  props: { modelValue: { default: () => [] }, fields: { default: () => [] } },
  emits: ['update:modelValue'],
  template: '<div data-stub="cm" />',
}
// ResponsiveDialog renders the form inside its #body-content slot; the shared overlay-stub doesn't
// render that named slot, so stub it here to render body-content when open.
const ResponsiveDialogStub = {
  name: 'ResponsiveDialog',
  props: { modelValue: { type: Boolean, default: false } },
  template: `<div v-if="modelValue" data-stub="rd"><slot name="body-content" /></div>`,
}

function mockReads(grain) {
  mockFrappeMethod(GETLIST, []) // no activity types needed for these cases
  mockFrappeMethod(GRAINS, grain)
  mockFrappeMethod(CATALOG_M, CATALOG)
}

function mountEditor(props = {}) {
  return mountTatva(SmartViewEditor, {
    props: { modelValue: false, ...props },
    global: {
      stubs: {
        ResponsiveDialog: ResponsiveDialogStub,
        ConditionBuilder: ConditionBuilderStub,
        ColumnManager: ColumnManagerStub,
      },
    },
  })
}

// open the modal (the load-on-open watch is async: grains -> get_view -> catalog).
async function open(wrapper) {
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  await flushPromises()
  await flushPromises()
}

const footBtn = (w, label) => w.findAll('button').find((b) => b.text().trim() === label)
const railBtn = (w, label) => w.findAll('button').find((b) => b.text().includes(label))

beforeEach(() => {
  createDialog.mockReset()
})

describe('SmartViewEditor', () => {
  it('open-create seeds a blank draft (empty name, Lead type, no type-locked note)', async () => {
    mockReads(GRAIN_ALL)
    const wrapper = mountEditor({ viewName: '' })
    await open(wrapper)

    expect(wrapper.find('input').element.value).toBe('') // Name empty
    // base_object defaults to Lead -> the Activity-only "Activity Type" field is not shown
    expect(wrapper.text()).not.toContain('Activity Type')
    // create mode: the edit-only "Type cannot be changed" note is absent
    expect(wrapper.text()).not.toContain('Type cannot be changed')
  })

  it('open-edit rehydrates every detail field from get_view', async () => {
    mockReads(GRAIN_ALL)
    mockFrappeMethod(GETVIEW, {
      name: 'SV-1',
      label: 'VIP Leads',
      base_object: 'Lead',
      activity_type: '',
      description: 'hot list',
      vertical: 'GoodFlip',
      group: 'Anaya',
      program: 'Nivolumab',
      predicate: PRED,
      columns: COLS,
      can_write: 1,
    })
    const wrapper = mountEditor({ viewName: 'SV-1' })
    await open(wrapper)

    expect(wrapper.find('input').element.value).toBe('VIP Leads') // Name seeded (edit branch ran)
    // edit mode marker: the type-locked explanatory note renders
    expect(wrapper.text()).toContain('Type cannot be changed')
    // can_write => Delete is offered
    expect(footBtn(wrapper, 'Delete')).toBeTruthy()
  })

  it('open-edit seeds the predicate + columns into the builders, dropping keys outside the catalog', async () => {
    mockReads(GRAIN_ALL)
    const editPred = { op: 'and', conditions: [{ field: 'lead_name', operator: 'like', value: 'asha' }] }
    mockFrappeMethod(GETVIEW, {
      name: 'SV-1',
      label: 'VIP Leads',
      base_object: 'Lead',
      predicate: editPred,
      columns: ['status', 'lead_name', 'ghost_field'], // ghost_field not in CATALOG -> dropped
      can_write: 1,
    })
    const wrapper = mountEditor({ viewName: 'SV-1' })
    await open(wrapper)

    // furthestStep is unlocked on edit, so jump straight to each builder via the step rail.
    await railBtn(wrapper, 'Condition').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(ConditionBuilderStub).props('modelValue')).toEqual(editPred)

    await railBtn(wrapper, 'Columns').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(ColumnManagerStub).props('modelValue')).toEqual(['status', 'lead_name'])
  })

  it('save assembles name+type+predicate+columns into the upsert_view payload, then closes and emits saved', async () => {
    mockReads(GRAIN_ALL)
    let saved = null
    const TAB = { name: 'sv-new', label: 'My Open Leads' }
    server.use(
      http.post(`*/api/method/${UPSERT}`, async ({ request }) => {
        saved = await request.json()
        return HttpResponse.json({ message: TAB })
      }),
    )
    const wrapper = mountEditor({ viewName: '' })
    await open(wrapper)

    // step 1: name it
    wrapper.findAllComponents(FormControl)[0].vm.$emit('update:modelValue', '  My Open Leads  ')
    await flushPromises()

    // step 2: feed a predicate via ConditionBuilder
    await footBtn(wrapper, 'Next').trigger('click')
    await flushPromises()
    wrapper.findComponent(ConditionBuilderStub).vm.$emit('update:modelValue', PRED)

    // step 3: feed the ordered columns via ColumnManager
    await footBtn(wrapper, 'Next').trigger('click')
    await flushPromises()
    wrapper.findComponent(ColumnManagerStub).vm.$emit('update:modelValue', COLS)
    await flushPromises()

    await footBtn(wrapper, 'Create view').trigger('click')
    await flushPromises()

    // the outbound contract: label is trimmed, optional/empty fields are omitted, the predicate tree
    // and ordered column list are persisted verbatim.
    expect(saved).not.toBeNull()
    expect(saved.view).toEqual({
      label: 'My Open Leads',
      base_object: 'Lead',
      predicate: PRED,
      columns: COLS,
    })
    // close + emit the tab returned by the server
    expect(wrapper.emitted('saved')[0]).toEqual([TAB])
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
  })

  it('a single-grain user has the grain auto-applied and stamped onto the save payload', async () => {
    mockReads(GRAIN_ONE)
    let saved = null
    server.use(
      http.post(`*/api/method/${UPSERT}`, async ({ request }) => {
        saved = await request.json()
        return HttpResponse.json({ message: { name: 'sv-1' } })
      }),
    )
    const wrapper = mountEditor({ viewName: '' })
    await open(wrapper)

    // grain locked: the "selected for you" note shows and the picker is disabled
    expect(wrapper.text()).toContain('You have one grain')

    wrapper.findAllComponents(FormControl)[0].vm.$emit('update:modelValue', 'Anaya Open')
    await flushPromises()
    await footBtn(wrapper, 'Next').trigger('click')
    await flushPromises()
    await footBtn(wrapper, 'Next').trigger('click')
    await flushPromises()
    await footBtn(wrapper, 'Create view').trigger('click')
    await flushPromises()

    expect(saved.view).toEqual({
      label: 'Anaya Open',
      base_object: 'Lead',
      vertical: 'GoodFlip',
      group: 'Anaya',
      program: 'Nivolumab',
      predicate: null,
      columns: [],
    })
  })

  it('validation: a blank name blocks Next (and therefore any save)', async () => {
    mockReads(GRAIN_ALL)
    const wrapper = mountEditor({ viewName: '' })
    await open(wrapper)

    expect(footBtn(wrapper, 'Next').element.disabled).toBe(true)

    wrapper.findAllComponents(FormControl)[0].vm.$emit('update:modelValue', 'Named now')
    await flushPromises()
    expect(footBtn(wrapper, 'Next').element.disabled).toBe(false)
  })

  it('validation: a multi-grain manager must pick a grain before Next unlocks', async () => {
    mockReads(GRAIN_MANY)
    const wrapper = mountEditor({ viewName: '' })
    await open(wrapper)

    // name set but grain still unpicked -> Next stays blocked
    wrapper.findAllComponents(FormControl)[0].vm.$emit('update:modelValue', 'Cross-grain')
    await flushPromises()
    expect(footBtn(wrapper, 'Next').element.disabled).toBe(true)

    // FormControls on step 1: [0]Name [1]Type [2]Grain [3]Description
    wrapper.findAllComponents(FormControl)[2].vm.$emit('update:modelValue', 'GoodFlip::Bhavna::Keytruda')
    await flushPromises()
    expect(footBtn(wrapper, 'Next').element.disabled).toBe(false)
  })

  it('delete confirms then calls delete_view, closes, and emits deleted', async () => {
    mockReads(GRAIN_ALL)
    mockFrappeMethod(GETVIEW, {
      name: 'SV-1',
      label: 'VIP Leads',
      base_object: 'Lead',
      predicate: null,
      columns: [],
      can_write: 1,
    })
    let deletedName = null
    server.use(
      http.post(`*/api/method/${DELETE}`, async ({ request }) => {
        deletedName = (await request.json()).name
        return HttpResponse.json({ message: {} })
      }),
    )
    const wrapper = mountEditor({ viewName: 'SV-1' })
    await open(wrapper)

    await footBtn(wrapper, 'Delete').trigger('click')
    // createDialog is mocked: pull its confirm action and run it (as the user clicking "Delete")
    expect(createDialog).toHaveBeenCalledTimes(1)
    const cfg = createDialog.mock.calls[0][0]
    const close = vi.fn()
    await cfg.actions[0].onClick(close)
    await flushPromises()

    expect(deletedName).toBe('SV-1')
    expect(close).toHaveBeenCalled()
    expect(wrapper.emitted('deleted')[0]).toEqual(['SV-1'])
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([false])
  })
})
