// A call card carries the same overflow as its siblings (CRM Call Log grants delete to the same three roles), while the rail — which strips the overflow from every card it draws — says so through the prop, because this is the one card it does not build itself.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'

vi.mock('@/stores/meta', () => ({ getMeta: () => ({ getFields: () => [] }) }))
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
import { createDialog } from '@/utils/dialogs'

import CallArea from '@/components/Activities/CallArea.vue'
import ActivityCard from '@/tatva/ActivityCard.vue'

const call = (over = {}) => ({
  name: 'CALL-001',
  type: 'Incoming',
  status: 'Completed',
  creation: '2026-06-01 10:00:00',
  _duration: '2m',
  _receiver: { label: 'Asha', image: '' },
  ...over,
})

const mount = (props) => mountTatva(CallArea, { props })
const LOG = 'crm.fcrm.doctype.crm_call_log.crm_call_log.get_call_log'

beforeEach(() => {
  createDialog.mockClear()
  mockFrappeMethod(LOG, {})
})

describe('the call card', () => {
  it('offers Delete, like every other card', () => {
    const card = mount({ activity: call() }).findComponent(ActivityCard)

    expect(card.props('menu')).toEqual([
      { label: 'Delete', icon: 'trash-2', key: 'delete' },
    ])
  })

  it('carries no overflow on the rail', () => {
    const card = mount({ activity: call(), showMenu: false }).findComponent(ActivityCard)

    expect(card.props('menu')).toEqual([])
  })
})

describe('deleting a call', () => {
  it('asks before doing it', async () => {
    const wrapper = mount({ activity: call() })

    wrapper.findComponent(ActivityCard).vm.$emit('action', 'delete')
    await flushPromises()

    expect(createDialog).toHaveBeenCalledTimes(1)
    expect(createDialog.mock.calls[0][0].actions[0].theme).toBe('red')
  })

  it('tells the tab to refresh, and owns no resource of its own', async () => {
    mockFrappeMethod('frappe.client.delete', null)
    const wrapper = mount({ activity: call() })

    wrapper.findComponent(ActivityCard).vm.$emit('action', 'delete')
    await flushPromises()
    await createDialog.mock.calls[0][0].actions[0].onClick(() => {})
    await flushPromises()

    expect(wrapper.emitted('changed')).toBeTruthy()
  })
})
