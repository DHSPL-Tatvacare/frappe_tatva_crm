// Purpose: CHARACTERISATION. This asserts the quick-filter bar exactly as it behaves today, BEFORE the
// picker underneath it is swapped for the app's own. It is not describing an improvement — it is the
// contract that must survive the swap: a field whose values the server listed offers several of them, a
// pick emits the values (never the option objects), and clearing emits nothing to filter on.
//
// Written first, deliberately. If the swap changes any of this, these go red in the same run rather than
// being found in a screenshot a day later.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuickFilterField from '@/components/QuickFilterField.vue'
import { DateRangePicker, DateTimePicker } from 'frappe-ui'

// A grain axis: the server hands the whole list, so the bar offers "is one of".
const LISTED = {
  fieldname: 'custom_substage',
  fieldtype: 'Link',
  label: 'Sub-stage',
  options: 'CRM Lead Stage',
  grain_options: ['Ayushman Scheme', 'Chemo not completed', 'Junk Lead'],
}

// A field nothing lists: typed, one value.
const TYPED = { fieldname: 'lead_name', fieldtype: 'Data', label: 'Full Name' }

// A moment in time: the panel filters these as a RANGE, the bar said `=` and matched that exact second.
const WHEN = { fieldname: 'creation', fieldtype: 'Datetime', label: 'Created On' }

const picker = (w) => w.findComponent({ name: 'Autocomplete' })

describe('quick filter bar — the contract a picker swap must not change', () => {
  it('offers SEVERAL values for a field the server listed', () => {
    const w = mount(QuickFilterField, { props: { filter: LISTED, appliedValue: [] } })
    expect(picker(w).exists()).toBe(true)
    expect(picker(w).props('multiple')).toBe(true)
  })

  it('offers exactly the values the server listed, no more', () => {
    const w = mount(QuickFilterField, { props: { filter: LISTED, appliedValue: [] } })
    const offered = picker(w).props('options').map((o) => o.value)
    expect(offered).toEqual(LISTED.grain_options)
  })

  it('emits the chosen VALUES, never the option objects', async () => {
    const w = mount(QuickFilterField, { props: { filter: LISTED, appliedValue: [] } })
    picker(w).vm.$emit('update:modelValue', [
      { label: 'Junk Lead', value: 'Junk Lead' },
      { label: 'Ayushman Scheme', value: 'Ayushman Scheme' },
    ])
    await w.vm.$nextTick()
    const emitted = w.emitted('applyQuickFilter').at(-1)
    expect(emitted[0].fieldname).toBe('custom_substage')
    expect(emitted[1]).toEqual(['Junk Lead', 'Ayushman Scheme'])
  })

  it('shows what is already applied', () => {
    const w = mount(QuickFilterField, {
      props: { filter: LISTED, appliedValue: ['Junk Lead'] },
    })
    const held = picker(w).props('modelValue')
    const values = (Array.isArray(held) ? held : []).map((o) => (o && o.value) ?? o)
    expect(values).toEqual(['Junk Lead'])
  })

  it('clearing emits an empty list, which the bar reads as no filter', async () => {
    const w = mount(QuickFilterField, { props: { filter: LISTED, appliedValue: ['Junk Lead'] } })
    picker(w).vm.$emit('update:modelValue', [])
    await w.vm.$nextTick()
    expect(w.emitted('applyQuickFilter').at(-1)[1]).toEqual([])
  })

  it('a field nothing lists stays a single typed box', () => {
    const w = mount(QuickFilterField, { props: { filter: TYPED, appliedValue: '' } })
    expect(picker(w).exists()).toBe(false)
  })
})


describe('quick filter bar — a date is picked from a list, like every neighbour', () => {
  // A calendar would fix the matching and break the row: every other control here is one click.
  it('offers frappe’s named ranges, not a calendar and not an instant', () => {
    const w = mount(QuickFilterField, { props: { filter: WHEN, appliedValue: '' } })
    expect(w.findComponent(DateRangePicker).exists()).toBe(false)
    expect(w.findComponent(DateTimePicker).exists()).toBe(false)
    // The same picker its neighbours use — the one control that caps a long list and scrolls it.
    expect(picker(w).exists()).toBe(true)
    const offered = picker(w).props('options').map((o) => o.value)
    expect(offered).toContain('today')
    expect(offered).toContain('last week')
    expect(offered).toContain('this month')
  })

  it('tells the list the operator it used, so the list never re-derives one', async () => {
    const w = mount(QuickFilterField, { props: { filter: WHEN, appliedValue: '' } })
    picker(w).vm.$emit('update:modelValue', { label: 'Last Week', value: 'last week' })
    await w.vm.$nextTick()
    const [field, value, operator] = w.emitted('applyQuickFilter').at(-1)
    expect(field.fieldname).toBe('creation')
    expect(value).toBe('last week')
    expect(operator).toBe('timespan')
  })

  it('a listed field still reports its own operator', async () => {
    const w = mount(QuickFilterField, { props: { filter: LISTED, appliedValue: [] } })
    picker(w).vm.$emit('update:modelValue', [{ label: 'Junk Lead', value: 'Junk Lead' }])
    await w.vm.$nextTick()
    expect(w.emitted('applyQuickFilter').at(-1)[2]).toBe('in')
  })
})
