// A typed filter value searches once, on Enter or leaving the box — never once per keystroke.
import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mountTatva } from './_mount'
import Filter from '@/components/Filter.vue'
import QuickFilterField from '@/components/QuickFilterField.vue'

// A keystroke fires `input` only; test-utils' setValue also fires `change`, which is the Enter under test.
async function type(input, text) {
  input.element.value = text
  await input.trigger('input')
}

const TITLE = {
  fieldname: 'title',
  fieldtype: 'Data',
  label: 'Title',
  options: '',
}
const COUNT = {
  fieldname: 'idx',
  fieldtype: 'Int',
  label: 'Index',
  options: '',
}

function mountPanel(field, filters) {
  return mountTatva(Filter, {
    props: {
      doctype: 'CRM Task',
      fields: [field],
      modelValue: { params: { filters } },
    },
  })
}

describe('filter panel — typed value', () => {
  it('typing emits no search; Enter emits exactly one with the whole text', async () => {
    const w = mountPanel(TITLE, { title: ['LIKE', '%F%'] })
    const input = w.find('#value input')
    for (const text of ['Fu', 'Fut', 'Fu', 'Future']) await type(input, text)
    expect(w.emitted('update')).toBeUndefined()
    await input.trigger('change')
    expect(w.emitted('update')).toHaveLength(1)
    expect(w.emitted('update')[0][0]).toEqual({ title: ['LIKE', '%Future%'] })
  })

  it('a number box waits for Enter too', async () => {
    const w = mountPanel(COUNT, { idx: ['>', 1] })
    const input = w.find('#value input')
    await type(input, '12')
    expect(w.emitted('update')).toBeUndefined()
    await input.trigger('change')
    expect(w.emitted('update')).toHaveLength(1)
  })
})

describe('quick filter bar — typed value', () => {
  it('a burst of typing searches once, after the pause', async () => {
    const w = mountTatva(QuickFilterField, {
      props: { filter: COUNT, appliedValue: '' },
    })
    const input = w.find('input')
    for (const text of ['1', '12', '123']) await type(input, text)
    expect(w.emitted('applyQuickFilter')).toBeUndefined()
    await new Promise((r) => setTimeout(r, 650))
    expect(w.emitted('applyQuickFilter')).toHaveLength(1)
    expect(w.emitted('applyQuickFilter')[0][1]).toBe('123')
  })

  it('a late reload does not overwrite what the person is typing', async () => {
    const w = mountTatva(QuickFilterField, {
      props: { filter: TITLE, appliedValue: '' },
    })
    const input = w.find('input')
    await input.trigger('focus')
    await type(input, 'Future')
    await w.setProps({ appliedValue: 'Fu' })
    await nextTick()
    expect(input.element.value).toBe('Future')
  })
})
