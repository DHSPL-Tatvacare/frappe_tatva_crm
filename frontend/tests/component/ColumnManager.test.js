// Purpose: the generic column chooser's v-model is an ORDERED string[] of fieldnames — checking an
// available field appends it, removing drops it, and order is preserved. This is the integrity contract
// the smart-view column set depends on (C.12/C.18: a plain ordered list, no pinning).
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import ColumnManager from '@/tatva/ColumnManager.vue'

const fields = [
  { fieldname: 'a', label: 'Alpha' },
  { fieldname: 'b', label: 'Bravo' },
  { fieldname: 'c', label: 'Charlie' },
]

describe('ColumnManager', () => {
  it('reflects the selected set and its count', () => {
    const wrapper = mountTatva(ColumnManager, { props: { fields, modelValue: ['b', 'a'] } })
    expect(wrapper.text()).toContain('2/3') // selected / total
    const checked = wrapper.findAll('input[type="checkbox"]').filter((c) => c.element.checked)
    expect(checked).toHaveLength(2)
  })

  it('appends an available field to the ordered model when checked', async () => {
    const wrapper = mountTatva(ColumnManager, { props: { fields, modelValue: ['a'] } })
    const checks = wrapper.findAll('input[type="checkbox"]')
    await checks[2].setValue(true) // 'Charlie'
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual(['a', 'c'])
  })

  it('removes a selected column', async () => {
    const wrapper = mountTatva(ColumnManager, { props: { fields, modelValue: ['a', 'b'] } })
    await wrapper.findAll('button')[0].trigger('click') // ✕ on the first selected card ('a')
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual(['b'])
  })
})
