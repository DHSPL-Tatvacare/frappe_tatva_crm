// Purpose: TatvaTasks is the Tasks RENDERER for a CRM Lead. It has no resource of its own — <Activities>
// pages `kind: 'task'` on the shared endpoint and hands the page down as the `tasks` prop, so this spec
// drives the component through that contract: loading branch, rows render, empty → EmptyState, a terminal
// status shows a themed Badge (open statuses live in the tile control), day/due grouping, a card click
// opens the (stubbed) TaskModal in view mode for that exact task, and the "Log Activity" bridge opens the
// type picker. TaskModal is stubbed — we assert open intent. Delete asks first and refreshes through the
// ONE path the board owns (`changed`), never a resource of its own.
import { beforeEach, describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { Badge } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'

vi.mock('@/stores/meta', () => ({ getMeta: () => ({ getFields: () => [] }) }))
// The house mock: `utils/dialogs` is .jsx and vitest's vite transforms it against the React runtime.
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
import { createDialog } from '@/utils/dialogs'

import TatvaTasks from '@/tatva/TatvaTasks.vue'
import ActivityCard from '@/tatva/ActivityCard.vue'

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

function mount({ tasks = [], loading = false, stubs = {} } = {}) {
  return mountTatva(TatvaTasks, {
    props: { lead: 'LEAD-1', tasks, loading },
    global: { stubs: { TaskModal: TaskModalStub, ...stubs } },
  })
}

afterEach(() => {
  delete window.__tcLogActivity
  delete window.__tcReloadTasks
})

describe('TatvaTasks', () => {
  it('shows the loading branch while the page its parent owns is in flight', () => {
    mockFrappeMethod(MAP, {})
    const wrapper = mount({ loading: true })
    expect(wrapper.text()).toContain('Loading')
  })

  it('renders one ActivityCard per task with its title', async () => {
    mockFrappeMethod(MAP, {})
    const wrapper = mount({ tasks: [task()] })
    await flushPromises()

    expect(wrapper.findAllComponents(ActivityCard)).toHaveLength(1)
    expect(wrapper.text()).toContain('Call the patient')
  })

  it('shows the EmptyState when the lead has no tasks', async () => {
    mockFrappeMethod(MAP, {})
    const wrapper = mount()
    await flushPromises()

    expect(wrapper.text()).toContain('No tasks yet')
    expect(wrapper.findComponent(ActivityCard).exists()).toBe(false)
  })

  it('badges only a terminal status (open statuses live in the tile control)', async () => {
    mockFrappeMethod(MAP, {})
    const wrapper = mount({
      tasks: [
        task({ name: 'T-DONE', status: 'Done' }),
        task({ name: 'T-BL', status: 'Backlog' }),
      ],
    })
    await flushPromises()

    const badges = wrapper.findAllComponents(Badge)
    const done = badges.find((b) => b.props('label') === 'Done')
    expect(done.props('theme')).toBe('green') // statusTheme('Done')
    expect(badges.find((b) => b.props('label') === 'Backlog')).toBeUndefined() // open → no badge
  })

  it('groups by DAY and wears due state as a badge, read to the MINUTE not the date', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockFrappeMethod(MAP, {})
    const wrapper = mount({
      tasks: [
        task({ name: 'T-OVER', due_iso: '2000-01-01' }),
        task({ name: 'T-PASSED', due_iso: `${today} 00:00:01` }), // due EARLIER today — overdue, not today
        task({ name: 'T-TODAY', due_iso: `${today} 23:59:00` }), // still to come today
        task({ name: 'T-UP', due_iso: '2999-01-01' }),
        task({ name: 'T-DONE', status: 'Done' }),
      ],
    })
    await flushPromises()

    // The heading is the DAY the task was raised; due state is the card's badge, never a section.
    const text = wrapper.text()
    expect(text).toContain('1 Jun 2026')
    expect(text).toContain('Overdue by') // days late
    expect(text).toContain('Overdue') // due earlier TODAY is overdue, matching the server's due_state
    expect(text).toContain('Due today') // still to come today
    expect(text).toContain('Done') // terminal status badge; no due badge for it
  })

  it('opens the (stubbed) TaskModal in view mode for the exact task on card click', async () => {
    mockFrappeMethod(MAP, {})
    const wrapper = mount({ tasks: [task()] })
    await flushPromises()

    expect(wrapper.findComponent(TaskModalStub).exists()).toBe(false) // v-if, closed initially

    await wrapper.findComponent(ActivityCard).trigger('click')

    const modal = wrapper.findComponent(TaskModalStub)
    expect(modal.props('modelValue')).toBe(true)
    expect(modal.props('mode')).toBe('view')
    expect(modal.props('task')).toEqual({ name: 'TASK-001' })
    expect(modal.props('lead')).toBe('LEAD-1')
  })

  it('the Log Activity bridge opens the type picker and choosing a type opens the create form with that type', async () => {
    mockFrappeMethod(MAP, {})
    mockFrappeMethod(TYPES, [
      { name: 'ZZ Line::ZZ Group::ZZ Program::Visit', label: 'Home Visit' },
    ])
    const wrapper = mount({
      tasks: [task()],
      stubs: { Dialog: DialogBodyStub },
    })
    await flushPromises()

    expect(typeof window.__tcLogActivity).toBe('function')
    window.__tcLogActivity()
    await flushPromises()

    const typeBtn = wrapper
      .findAll('button')
      .find((b) => b.text() === 'Home Visit')
    expect(typeBtn).toBeTruthy()
    await typeBtn.trigger('click')

    const modal = wrapper.findComponent(TaskModalStub)
    expect(modal.props('modelValue')).toBe(true)
    // Log Activity is not its own mode: it is the create form with the chosen type passed in.
    expect(modal.props('mode')).toBe('create')
    expect(modal.props('defaultType')).toBe(
      'ZZ Line::ZZ Group::ZZ Program::Visit',
    )
    expect(modal.props('task')).toBe(null)
  })
})

describe('deleting a task', () => {
  // `createDialog` is a module-level vi.fn(), so its calls carry over from the previous case.
  beforeEach(() => createDialog.mockClear())

  it('offers Delete on the card and asks before doing it', async () => {
    mockFrappeMethod(MAP, {})
    const wrapper = mount({ tasks: [task()] })
    await flushPromises()

    const card = wrapper.findComponent(ActivityCard)
    expect(card.props('menu')).toEqual([
      { label: 'Delete', icon: 'trash-2', key: 'delete' },
    ])

    card.vm.$emit('action', 'delete')
    await flushPromises()

    expect(createDialog).toHaveBeenCalledTimes(1)
    const dialog = createDialog.mock.calls[0][0]
    expect(dialog.message).toContain('Call the patient')
    expect(dialog.actions[0].theme).toBe('red')
  })

  it('refreshes through the board own path, never a resource of its own', async () => {
    mockFrappeMethod(MAP, {})
    mockFrappeMethod('frappe.client.delete', null)
    const wrapper = mount({ tasks: [task()] })
    await flushPromises()

    wrapper.findComponent(ActivityCard).vm.$emit('action', 'delete')
    await flushPromises()

    await createDialog.mock.calls[0][0].actions[0].onClick(() => {})
    await flushPromises()

    expect(wrapper.emitted('changed')).toBeTruthy()
  })
})

