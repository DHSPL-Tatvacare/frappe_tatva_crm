// Purpose: TatvaTasks is the native, config-driven Tasks board for a CRM Lead. It loads its rows from ONE
// server method (tatva_connect.activity.api.lead_task_board, keyed on the `lead` prop) and renders each
// task through the shared ActivityCard, in a soft-bucketed timeline (Overdue/Due Today/Upcoming/History).
// This spec pins the real contract at the network boundary (MSW): loading branch, rows render, empty →
// EmptyState, a terminal status shows a themed Badge (open statuses live in the tile control), buckets
// group by due_iso/status, a card click opens the (stubbed) TaskModal in view mode for that exact task,
// and the "Log Activity" bridge opens the type picker. TaskModal is stubbed — we assert open intent.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { Badge } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'

vi.mock('@/stores/meta', () => ({ getMeta: () => ({ getFields: () => [] }) }))

import TatvaTasks from '@/tatva/TatvaTasks.vue'
import ActivityCard from '@/tatva/ActivityCard.vue'

const BOARD = 'tatva_connect.activity.api.lead_task_board'
const MAP = 'tatva_connect.location.api.map_config'
const TYPES = 'tatva_connect.activity.api.list_types_for_lead'

const TaskModalStub = {
  name: 'TaskModalStub',
  props: ['modelValue', 'task', 'lead', 'mode', 'defaultType', 'mapConfig'],
  template: '<div data-stub="task-modal" />',
}

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
  due_iso: '2999-01-01',
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
    const wrapper = mount()
    expect(wrapper.text()).toContain('Loading')
  })

  it('renders one ActivityCard per task with its title', async () => {
    mockFrappeMethod(BOARD, { tasks: [task()], types: {} })
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    expect(wrapper.findAllComponents(ActivityCard)).toHaveLength(1)
    expect(wrapper.text()).toContain('Call the patient')
  })

  it('shows the EmptyState when the lead has no tasks', async () => {
    mockFrappeMethod(BOARD, { tasks: [], types: {} })
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    expect(wrapper.text()).toContain('No tasks yet')
    expect(wrapper.findComponent(ActivityCard).exists()).toBe(false)
  })

  it('badges only a terminal status (open statuses live in the tile control)', async () => {
    mockFrappeMethod(BOARD, {
      tasks: [task({ name: 'T-DONE', status: 'Done' }), task({ name: 'T-BL', status: 'Backlog' })],
      types: {},
    })
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    const badges = wrapper.findAllComponents(Badge)
    const done = badges.find((b) => b.props('label') === 'Done')
    expect(done.props('theme')).toBe('green') // statusTheme('Done')
    expect(badges.find((b) => b.props('label') === 'Backlog')).toBeUndefined() // open → no badge
  })

  it('groups tasks into due-relation buckets, bucketing a datetime due on its date', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockFrappeMethod(BOARD, {
      tasks: [
        task({ name: 'T-OVER', due_iso: '2000-01-01' }),
        task({ name: 'T-TODAY', due_iso: `${today} 15:30:00` }), // datetime, not date — must still be Today
        task({ name: 'T-UP', due_iso: '2999-01-01' }),
        task({ name: 'T-DONE', status: 'Done' }),
      ],
      types: {},
    })
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Overdue')
    expect(text).toContain('Due Today')
    expect(text).toContain('Upcoming')
    expect(text).toContain('History')
  })

  it('opens the (stubbed) TaskModal in view mode for the exact task on card click', async () => {
    mockFrappeMethod(BOARD, { tasks: [task()], types: {} })
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    expect(wrapper.findComponent(TaskModalStub).exists()).toBe(false) // v-if, closed initially

    await wrapper.findComponent(ActivityCard).trigger('click')

    const modal = wrapper.findComponent(TaskModalStub)
    expect(modal.props('modelValue')).toBe(true)
    expect(modal.props('mode')).toBe('view')
    expect(modal.props('task')).toEqual({ name: 'TASK-001' })
    expect(modal.props('lead')).toBe('LEAD-1')
  })

  it('the Log Activity bridge opens the type picker and choosing a type opens TaskModal in log mode', async () => {
    mockFrappeMethod(BOARD, { tasks: [task()], types: {} })
    mockFrappeMethod(MAP, {})
    mockFrappeMethod(TYPES, [{ name: 'GoodFlip::Anaya::Nivolumab::Visit', label: 'Home Visit' }])
    const wrapper = mount({ Dialog: DialogBodyStub })
    await flushPromises()

    expect(typeof window.__tcLogActivity).toBe('function')
    window.__tcLogActivity()
    await flushPromises()

    const typeBtn = wrapper.findAll('button').find((b) => b.text() === 'Home Visit')
    expect(typeBtn).toBeTruthy()
    await typeBtn.trigger('click')

    const modal = wrapper.findComponent(TaskModalStub)
    expect(modal.props('modelValue')).toBe(true)
    expect(modal.props('mode')).toBe('log')
    expect(modal.props('defaultType')).toBe('GoodFlip::Anaya::Nivolumab::Visit')
    expect(modal.props('task')).toBe(null)
  })
})
