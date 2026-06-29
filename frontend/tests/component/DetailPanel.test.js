// Purpose: the record DetailPanel resolves its sections/fields/values from ONE server method
// (tatva_connect.lead.detail.lead_detail) and renders them as native two-column rows — section labels,
// field labels, and plain-text values (Check → Yes/No, blanks → —). Empty fields are hidden by default
// (hideEmpty ON), `compact` strips the header chrome, no sections → the native EmptyState, and pressing
// Edit swaps the read-only spans for Save/Cancel edit affordances. Data is mocked at the network layer
// with MSW (frappe-ui's own test convention), so this exercises the real createResource path. The
// component emits nothing — its whole contract is what it renders from the resource.
import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { LoadingIndicator } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'
import DetailPanel from '@/tatva/DetailPanel.vue'

// Section/field shape returned by lead_detail. `empty` drives hide-empty, `read_only` keeps a field a
// plain span even in edit mode, `fieldtype`/value drive displayValue.
const sections = [
  {
    key: 'patient',
    label: 'Patient',
    fields: [
      { field_key: 'first_name', label: 'First Name', fieldtype: 'Data', value: 'Asha', empty: false, read_only: false },
      { field_key: 'consent', label: 'Consent Given', fieldtype: 'Check', value: 1, empty: false, read_only: false },
      { field_key: 'middle_name', label: 'Middle Name', fieldtype: 'Data', value: '', empty: true, read_only: false },
    ],
  },
]

const mountLoaded = async (props = {}) => {
  mockFrappeMethod('tatva_connect.lead.detail.lead_detail', { sections })
  const wrapper = mountTatva(DetailPanel, { props: { docname: 'LEAD-1', ...props } })
  await flushPromises()
  return wrapper
}

describe('DetailPanel', () => {
  it('shows the loading indicator until the resource resolves', () => {
    mockFrappeMethod('tatva_connect.lead.detail.lead_detail', { sections })
    const wrapper = mountTatva(DetailPanel, { props: { docname: 'LEAD-1' } })
    // auto:true fired the fetch synchronously on mount; before flush, panel.loading is true.
    expect(wrapper.findComponent(LoadingIndicator).exists()).toBe(true)
  })

  it('renders section labels, field labels and values from the resource', async () => {
    const wrapper = await mountLoaded()
    expect(wrapper.findComponent(LoadingIndicator).exists()).toBe(false)
    expect(wrapper.text()).toContain('Patient') // section label
    expect(wrapper.text()).toContain('First Name') // field label
    expect(wrapper.text()).toContain('Asha') // field value
  })

  it('renders a Check field as Yes/No, not its raw 1/0', async () => {
    const wrapper = await mountLoaded()
    expect(wrapper.text()).toContain('Consent Given')
    expect(wrapper.text()).toContain('Yes')
  })

  it('hides empty fields by default (hideEmpty ON)', async () => {
    const wrapper = await mountLoaded()
    expect(wrapper.text()).not.toContain('Middle Name')
  })

  it('shows the header chrome (Data title + Edit) when not compact', async () => {
    const wrapper = await mountLoaded()
    expect(wrapper.text()).toContain('Data')
    expect(wrapper.text()).toContain('Edit')
  })

  it('strips the header chrome in compact mode', async () => {
    const wrapper = await mountLoaded({ compact: true })
    expect(wrapper.text()).not.toContain('Data') // no title row
    expect(wrapper.text()).not.toContain('Edit') // no edit button
    expect(wrapper.text()).toContain('Asha') // body still renders
  })

  it('shows the native empty state when the record has no sections', async () => {
    mockFrappeMethod('tatva_connect.lead.detail.lead_detail', { sections: [] })
    const wrapper = mountTatva(DetailPanel, { props: { docname: 'LEAD-1' } })
    await flushPromises()
    expect(wrapper.text()).toContain('No details to show')
  })

  it('swaps read-only spans for Save/Cancel edit affordances when Edit is pressed', async () => {
    const wrapper = await mountLoaded()
    expect(wrapper.text()).not.toContain('Save')
    const editBtn = wrapper.findAll('button').find((b) => b.text() === 'Edit')
    expect(editBtn).toBeTruthy()
    await editBtn.trigger('click')
    expect(wrapper.text()).toContain('Save')
    expect(wrapper.text()).toContain('Cancel')
  })
})
