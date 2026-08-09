// The workflow header answers three questions in order — what is this, is it running, what can I do — and it answered none of them: Save stayed lit and wore a tick, the content hash sat on the surface, Edit and Revise were two doors to one room, Suspend was the loudest thing on screen, and nothing said what the workflow watches. Asserted through the real page with the canvas stubbed, because none of this is a canvas contract.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { Button } from 'frappe-ui'

const createDialog = vi.fn()
vi.mock('@/utils/dialogs', () => ({
  createDialog: (...args) => createDialog(...args),
}))

import { mountTatva } from './_mount'
import { mockFrappeMethod } from './_msw'
import WorkflowDetail from '@/tatva/workflows/WorkflowDetail.vue'

const GET = 'tatva_connect.workflows.api.get_workflow'
const HASH = 'a1b7df2e'

// The canvas owns dirtiness; this ref is the page's only window onto it, so the test drives it directly.
const canvasDirty = ref(false)
const CanvasStub = {
  name: 'WorkflowCanvas',
  props: ['definition', 'editable', 'problems'],
  template: '<div data-stub="canvas" />',
  setup(_props, { expose }) {
    expose({
      dirty: canvasDirty,
      ready: true,
      serialize: () => ({ nodes: [], canvas: {} }),
      markClean: () => (canvasDirty.value = false),
    })
    return () => null
  },
}

// The shared mount stubs Popover as a passthrough that renders `#body`, while the header's version control uses `#target` and `#body-main` — and only the TARGET is on the surface, a closed popover being the state the "keep the hash off the surface" assertion is about.
const PopoverStub = {
  name: 'PopoverStub',
  template:
    '<div data-stub="Popover"><slot name="target" :togglePopover="() => {}" /></div>',
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/workflows',
      name: 'Workflows',
      component: { template: '<div />' },
    },
    {
      path: '/workflows/:workflowId',
      name: 'Workflow',
      component: { template: '<div />' },
    },
  ],
})

function doc(overrides = {}) {
  return {
    name: 'WF-1',
    workflow_name: 'TP Courtesy Visit - Field Visit',
    lifecycle_state: 'Active',
    trigger_doctype: 'CRM Task',
    trigger_mode: 'Record Event',
    trigger_event: 'Updated',
    trigger_vertical: 'Tatvapractice',
    trigger_group: 'Tatvapractice::India',
    trigger_program: 'Tatvapractice::India::Field-Sales',
    cohort_state: null,
    canvas_json: null,
    nodes: [],
    version: {
      name: 'V-1',
      version_no: 1,
      node_count: 6,
      hash: HASH,
      created: '2026-08-01 10:00:00',
    },
    ...overrides,
  }
}

async function mountPage(overrides = {}) {
  mockFrappeMethod(GET, doc(overrides))
  const wrapper = mountTatva(WorkflowDetail, {
    props: { workflowId: 'WF-1' },
    global: {
      plugins: [router],
      stubs: { WorkflowCanvas: CanvasStub, Popover: PopoverStub },
    },
  })
  await flushPromises()
  return wrapper
}

const labels = (wrapper) =>
  wrapper.findAllComponents(Button).map((b) => b.props('label'))
const buttonNamed = (wrapper, label) =>
  wrapper.findAllComponents(Button).find((b) => b.props('label') === label)
// frappe-ui's Button roots on a Tooltip, so the real <button> is what a click has to land on.
const click = (wrapper, label) =>
  buttonNamed(wrapper, label).get('button').trigger('click')

describe('WorkflowDetail header', () => {
  beforeEach(() => {
    canvasDirty.value = false
    createDialog.mockReset()
  })

  it('says what the workflow watches — the trigger and the grain, both already on the doc', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()
    expect(text).toContain('CRM Task')
    expect(text).toContain('Updated')
    expect(text).toContain('Field-Sales')
  })

  it('keeps the content hash off the surface', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('v1')
    expect(wrapper.text()).not.toContain(HASH)
  })

  it('offers ONE primary verb called Edit, in every state', async () => {
    for (const state of ['Draft', 'Published', 'Active', 'Suspended']) {
      const wrapper = await mountPage({ lifecycle_state: state })
      expect(labels(wrapper)).toContain('Edit')
      expect(labels(wrapper)).not.toContain('Revise')
    }
  })

  it('does not put a destructive verb on the surface beside it', async () => {
    const wrapper = await mountPage({ lifecycle_state: 'Active' })
    expect(labels(wrapper)).not.toContain('Suspend')
    expect(labels(wrapper)).not.toContain('Archive')
  })

  it('editing a live workflow confirms with the consequence, in a sentence', async () => {
    const wrapper = await mountPage({ lifecycle_state: 'Active' })
    await click(wrapper, 'Edit')
    expect(createDialog).toHaveBeenCalled()
    expect(createDialog.mock.calls[0][0].message).toBe(
      'Editing stops new runs starting. Journeys already running finish on the frozen version.',
    )
  })

  it('a draft is edited outright — there is nothing running to warn about', async () => {
    const wrapper = await mountPage({ lifecycle_state: 'Draft' })
    await click(wrapper, 'Edit')
    expect(createDialog).not.toHaveBeenCalled()
    expect(wrapper.vm.editable).toBe(true)
  })

  it('Save is dead while the draft is clean, and wears no tick', async () => {
    const wrapper = await mountPage({ lifecycle_state: 'Draft' })
    await click(wrapper, 'Edit')
    await flushPromises()

    const save = buttonNamed(wrapper, 'Save')
    expect(save.props('disabled')).toBe(true)
    expect(save.props('iconLeft')).toBeFalsy()

    canvasDirty.value = true
    await nextTick()
    expect(buttonNamed(wrapper, 'Save').props('disabled')).toBe(false)
  })

  it('edit mode looks different, and says whether the work is committed', async () => {
    const wrapper = await mountPage({ lifecycle_state: 'Draft' })
    await click(wrapper, 'Edit')
    await flushPromises()
    expect(wrapper.text()).toContain('Editing draft — all changes saved')

    canvasDirty.value = true
    await nextTick()
    expect(wrapper.text()).toContain('Editing draft — unsaved changes')
  })

  it('drops the lifecycle verbs while editing — transitions already returns none', async () => {
    const wrapper = await mountPage({ lifecycle_state: 'Draft' })
    await click(wrapper, 'Edit')
    await flushPromises()
    expect(labels(wrapper)).not.toContain('Edit')
    expect(wrapper.vm.lifecycleGroups).toEqual([])
  })

  it('puts the destructive verbs in the overflow, below their own divider', async () => {
    const wrapper = await mountPage({ lifecycle_state: 'Suspended' })
    const groups = wrapper.vm.lifecycleGroups
    expect(groups.length).toBe(2)
    expect(groups[0].items.map((i) => i.label)).toEqual(['Activate'])
    expect(groups[1].items.map((i) => i.label)).toEqual(['Archive'])
  })

  it('offers the run history', async () => {
    const wrapper = await mountPage()
    expect(labels(wrapper)).toContain('Runs')
  })
})
