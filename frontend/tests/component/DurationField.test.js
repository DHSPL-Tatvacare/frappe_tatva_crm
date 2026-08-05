import { describe, it, expect } from 'vitest'
import { FormControl } from 'frappe-ui'
import { mountTatva } from './_mount'
import DurationField from '@/tatva/workflows/DurationField.vue'

// How long a Wait waits. This box used to be a plain `Data` input that silently required a Python dict
// literal — type `2 minutes` and the journey threw at a live patient with a message about add_to_date
// kwargs. What is asserted here is the STORED value, because the stored form is the contract: it is what
// `wait_resume_at` has always been handed and it did not change.
//
// The units are the backend's, read off `add_to_date` itself, so this file names none of them.
const UNITS = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds']

function mountWith(modelValue = '', overrides = {}) {
  return mountTatva(DurationField, { props: { modelValue, units: UNITS, ...overrides } })
}

const lastEmit = (w) => w.emitted('update:modelValue').at(-1)[0]
// `modelValue` and `disabled` are FALLTHROUGH attrs on frappe-ui's FormControl, not declared props —
// it declares only type/size/variant/label and passes the rest down through `useAttrs`. Reading them
// with `.props()` answers undefined for every control in this app.
const unitSelect = (w) => w.findAllComponents(FormControl).find((c) => c.props('type') === 'select')
const unitValue = (w) => unitSelect(w).vm.$attrs.modelValue

describe('DurationField — a length of time, stored as what the resolver already takes', () => {
  it('reads a stored delay back as an amount and a unit', () => {
    const w = mountWith('{"days": 14}')
    expect(w.find('input[data-test="duration-amount"]').element.value).toBe('14')
    expect(unitValue(w)).toBe('days')
  })

  it('stores what the resolver already takes, not seconds', async () => {
    // The reason this is not the fork's own DurationInput: that control and `formatDuration` both speak
    // seconds, and a month is not a fixed number of them.
    const w = mountWith('{"months": 1}')
    await w.find('input[data-test="duration-amount"]').setValue('2')
    expect(lastEmit(w)).toBe('{"months":2}')
  })

  it('keeps the amount when only the unit changes', async () => {
    const w = mountWith('{"minutes": 5}')
    await unitSelect(w).vm.$emit('update:modelValue', 'hours')
    expect(lastEmit(w)).toBe('{"hours":5}')
  })

  it('stores nothing at all when the amount is emptied, so no delay has ONE representation', async () => {
    const w = mountWith('{"minutes": 5}')
    await w.find('input[data-test="duration-amount"]').setValue('')
    expect(lastEmit(w)).toBe('')
  })

  it('leaves a computed delay in its own box rather than rewriting it', () => {
    // `{"days": ctx["n"]}` is a legitimate delay the two boxes cannot express. Silently turning it into
    // something they can would change when a real patient is contacted.
    const w = mountWith('{"days": ctx["n"]}')
    expect(w.find('[data-test="duration-expression"]').exists()).toBe(true)
    expect(w.find('input[data-test="duration-amount"]').exists()).toBe(false)
    expect(w.text()).toContain('worked out as the journey runs')
  })

  it('leaves a delay in a unit it was not offered in its own box too', () => {
    // Nothing is rewritten just because this control would not have offered it.
    expect(mountWith('{"fortnights": 1}').find('[data-test="duration-expression"]').exists()).toBe(true)
    expect(mountWith('{"days": 1, "hours": 2}').find('[data-test="duration-expression"]').exists()).toBe(true)
  })

  it('starts empty on the first declared unit rather than showing a phantom delay', () => {
    const w = mountWith('')
    expect(w.find('input[data-test="duration-amount"]').element.value).toBe('')
    expect(unitValue(w)).toBe('years')
  })

  it('disables both boxes when the node is not editable', () => {
    const w = mountWith('{"days": 14}', { disabled: true })
    expect(w.find('input[data-test="duration-amount"]').attributes('disabled')).toBeDefined()
    expect(unitSelect(w).vm.$attrs.disabled).toBe(true)
  })
})
