// Purpose: TatvaTasks is the native, config-driven Tasks board for a CRM Lead. It loads its rows from
// ONE server method (tatva_connect.activity.api.lead_task_board, keyed on the `lead` prop) and renders
// each task as a uniform card: status control + title + #id + a themed status Badge. This spec pins the
// real contract at the network boundary (MSW): loading branch, rows render title + status, empty →
// EmptyState, the status Badge theme reflects the shared statusTheme map, a card click opens the
// (stubbed) TaskModal in view mode for that exact task, and the "Log Activity" bridge opens the
// grain-scoped type picker whose chosen type opens TaskModal in log mode. TaskModal is stubbed (its own
// contract is tested elsewhere) — we assert it is opened with the right props, not its internals.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { Badge } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'

// taskStatusOptions (in a template binding) calls getMeta('CRM Task'); left real it background-fetches
// doctype meta every render with no backend. Stub the store so options fall back to defaults — no fetch.
vi.mock('@/stores/meta', () => ({ getMeta: () => ({ getFields: () => [] }) }))

import TatvaTasks from '@/tatva/TatvaTasks.vue'

const BOARD = 'tatva_connect.activity.api.lead_task_board'
const MAP = 'tatva_connect.location.api.map_config'
const TYPES = 'tatva_connect.activity.api.list_types_for_lead'

// Stub the heavy modal — not under test here. Declares the props TatvaTasks binds so we can assert the
// open intent (v-model, mode, task, default-type) without rendering the real modal.
const TaskModalStub = {
  name: 'TaskModalStub',
  props: ['modelValue', 'task', 'lead', 'mode', 'defaultType', 'mapConfig'],
  template: '<div data-stub="task-modal" />',
}

// A Dialog stub that DOES render the #body-content slot (the shared overlay stub only forwards the
// default + `body` slots). Lets the "Log Activity" picker's type buttons reach the DOM so we can click.
const DialogBodyStub = {
  name: 'DialogBodyStub',
  template: '<div data-stub="dialog"><slot name="body-content" /></div>',
}

const task = (over = {}) => ({
  name: 'TASK-001',
  title: 'Call the patient',
  status: 'Todo',
  rep_name: 'Asha',
  rep_image: '',
  creation: '2026-06-01 10:00:00',
  task_type: 'visit',
  ...over,
})

function mount(extraStubs = {}) {
  return mountTatva(TatvaTasks, {
    props: { lead: 'LEAD-1' },
    global: { stubs: { TaskModal: TaskModalStub, ...extraStubs } },
  })
}

afterEach(() => {
  delete window.__tcLogActivity
  delete window.__tcReloadTasks
})

describe('TatvaTasks', () => {
  it('shows the loading branch while the board resource is in flight', () => {
    mockFrappeMethod(BOARD, { tasks: [], types: {} })
    mockFrappeMethod(MAP, {})
    // The immediate `lead` watch fires board.reload() synchronously on mount → loading, no data yet.
    const wrapper = mount()
    expect(wrapper.text()).toContain('Loading')
  })

  it('renders one card per task with its title and status', async () => {
    mockFrappeMethod(BOARD, { tasks: [task()], types: {} })
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    expect(wrapper.text()).toContain('Call the patient') // title
    expect(wrapper.text()).toContain('#TASK-001') // unique id
    expect(wrapper.findAll('[class*="cursor-pointer"]')).toHaveLength(1) // one card body
  })

  it('shows the EmptyState when the lead has no tasks', async () => {
    mockFrappeMethod(BOARD, { tasks: [], types: {} })
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    expect(wrapper.text()).toContain('No tasks yet')
    expect(wrapper.find('[class*="cursor-pointer"]').exists()).toBe(false)
  })

  it('themes the status Badge from the shared statusTheme map', async () => {
    mockFrappeMethod(BOARD, {
      tasks: [task({ name: 'T-DONE', status: 'Done' }), task({ name: 'T-BL', status: 'Backlog' })],
      types: {},
    })
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    const badges = wrapper.findAllComponents(Badge)
    const done = badges.find((b) => b.props('label') === 'Done')
    const backlog = badges.find((b) => b.props('label') === 'Backlog')
    expect(done.props('theme')).toBe('green') // statusTheme('Done')
    expect(backlog.props('theme')).toBe('orange') // statusTheme('Backlog')
  })

  it('opens the (stubbed) TaskModal in view mode for the exact task on card click', async () => {
    mockFrappeMethod(BOARD, { tasks: [task()], types: {} })
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    // TaskModal is v-if="modalOpen" — not mounted until a card is clicked.
    expect(wrapper.findComponent(TaskModalStub).exists()).toBe(false) // closed initially

    await wrapper.find('[class*="cursor-pointer"]').trigger('click')

    const modal = wrapper.findComponent(TaskModalStub)
    expect(modal.props('modelValue')).toBe(true)
    expect(modal.props('mode')).toBe('view')
    expect(modal.props('task')).toEqual({ name: 'TASK-001' })
    expect(modal.props('lead')).toBe('LEAD-1')
  })

  it('the Log Activity bridge opens the type picker and choosing a type opens TaskModal in log mode', async () => {
    mockFrappeMethod(BOARD, { tasks: [task()], types: {} })
    mockFrappeMethod(MAP, {})
    mockFrappeMethod(TYPES, [
      { name: 'GoodFlip::Anaya::Nivolumab::Visit', label: 'Home Visit' },
    ])
    const wrapper = mount({ Dialog: DialogBodyStub })
    await flushPromises()

    // onMounted wires the header "Log Activity" split button to openCreate via this window bridge.
    expect(typeof window.__tcLogActivity).toBe('function')
    window.__tcLogActivity()
    await flushPromises()

    // The picker now lists the grain-scoped type by its label (the :: PK never shows).
    const typeBtn = wrapper.findAll('button').find((b) => b.text() === 'Home Visit')
    expect(typeBtn).toBeTruthy()

    await typeBtn.trigger('click')

    const modal = wrapper.findComponent(TaskModalStub)
    expect(modal.props('modelValue')).toBe(true)
    expect(modal.props('mode')).toBe('log')
    expect(modal.props('defaultType')).toBe('GoodFlip::Anaya::Nivolumab::Visit')
    expect(modal.props('task')).toBe(null) // create path, not editing an existing task
  })
})
