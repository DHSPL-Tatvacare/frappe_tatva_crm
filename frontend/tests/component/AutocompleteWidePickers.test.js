// Purpose: under provideWidePickers a long chosen value shows in full on hover; without it the trigger stays stock.
import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { provideWidePickers } from '@/tatva/pickerLayout'

const LONG = 'Round Robin — Goodflip / Visit-Corporate / PolicyBazaar'
const OPTIONS = [{ label: LONG, value: 'pool-policy' }, { label: 'Short', value: 'short' }]

const OnWideScreen = defineComponent({
  props: ['modelValue'],
  setup(props) {
    provideWidePickers()
    return () => h(Autocomplete, { options: OPTIONS, modelValue: props.modelValue })
  },
})

describe('Autocomplete on a screen with wide pickers', () => {
  it('shows the chosen label in full on hover', () => {
    const w = mount(OnWideScreen, { props: { modelValue: 'pool-policy' } })
    expect(w.find('button').attributes('title')).toBe(LONG)
  })

  it('adds no hover text while nothing is chosen', () => {
    const w = mount(OnWideScreen, { props: { modelValue: '' } })
    expect(w.find('button').attributes('title')).toBeUndefined()
  })

  it('leaves every other screen stock: no hover text without the provider', () => {
    const w = mount(Autocomplete, { props: { options: OPTIONS, modelValue: 'pool-policy' } })
    expect(w.find('button').attributes('title')).toBeUndefined()
  })
})
