// Purpose: the grain UX invariant on the create modal — a single-entitlement user is NEVER asked (the
// grain is shown locked and applied silently), a manager with several grains gets a required picker, and
// a System Manager (grainAll) sees nothing here. Backed by the ONE grain brain (useEntitledGrains, mocked).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountTatva } from './_mount.js'
import { FormControl } from 'frappe-ui'

vi.mock('@/tatva/useEntitledGrains', async () => {
  const { ref } = await import('vue')
  const state = {
    grainAll: ref(false),
    grainOptions: ref([]),
    grainLocked: ref(false),
    grainLoading: ref(false),
  }
  return { useEntitledGrains: () => state, __state: state }
})

import { __state } from '@/tatva/useEntitledGrains'
import GrainSelect from '@/tatva/GrainSelect.vue'

const A = { label: 'ZZ Line::ZZ Group::ZZ Program', value: 'ZZ Line::ZZ Group::ZZ Program' }
const B = { label: 'ZZ Line::ZZ Group Two::ZZ Program Two', value: 'ZZ Line::ZZ Group Two::ZZ Program Two' }

beforeEach(() => {
  __state.grainAll.value = false
  __state.grainOptions.value = []
  __state.grainLocked.value = false
  __state.grainLoading.value = false
})

describe('GrainSelect', () => {
  it('manager with multiple grains gets a required picker', () => {
    __state.grainOptions.value = [A, B]
    const wrapper = mountTatva(GrainSelect, { props: { modelValue: '' } })
    expect(wrapper.findComponent(FormControl).exists()).toBe(true)
  })

  it('single-grain user sees a locked confirmation and the value is applied silently', () => {
    __state.grainOptions.value = [A]
    __state.grainLocked.value = true
    const wrapper = mountTatva(GrainSelect, { props: { modelValue: '' } })
    expect(wrapper.findComponent(FormControl).exists()).toBe(false) // no picker
    expect(wrapper.text()).toContain('ZZ Line::ZZ Group::ZZ Program') // locked confirmation
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([A.value]) // silent apply
  })

  it('System Manager (grainAll) renders nothing', () => {
    __state.grainAll.value = true
    __state.grainOptions.value = [A]
    const wrapper = mountTatva(GrainSelect, { props: { modelValue: '' } })
    expect(wrapper.text()).toBe('')
  })
})
