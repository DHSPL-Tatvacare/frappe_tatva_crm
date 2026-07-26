// Purpose: one doctor row in the Near Me list is pure presentation — it must surface the doctor's
// name, the dot-separated meta line, the optional address/grain chrome, and a human distance, while
// wiring the three page intents (select the body, call, directions). The call/directions buttons must
// fail-closed (disabled) when the doctor lacks a number or coordinates so a rep can't fire a dead action.
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import TatvaDoctorCard from '@/tatva/TatvaDoctorCard.vue'

const baseDoctor = {
  name: 'CRM-LEAD-001',
  title: 'Dr. Asha Rao',
  stage: 'Engaged',
  source: 'Referral',
  address: '12 MG Road, Bengaluru',
  grain: 'ZZ Care::ZZ Group::ZZ Program',
  mobile_no: '+91 99000 11000',
  lat: 12.97,
  lng: 77.59,
  distance_m: 450,
}

describe('TatvaDoctorCard', () => {
  it('renders name, dot-separated meta, address, grain badge and a metres distance', () => {
    const wrapper = mountTatva(TatvaDoctorCard, { props: { doctor: baseDoctor } })
    expect(wrapper.text()).toContain('Dr. Asha Rao')
    expect(wrapper.text()).toContain('Engaged')
    expect(wrapper.text()).toContain('Referral')
    expect(wrapper.text()).toContain('12 MG Road, Bengaluru')
    expect(wrapper.text()).toContain('ZZ Care::ZZ Group::ZZ Program')
    expect(wrapper.text()).toContain('450 m') // distance_m < 1000 -> metres
  })

  it('falls back to name when title is absent and drops the optional address/grain chrome', () => {
    const wrapper = mountTatva(TatvaDoctorCard, {
      props: { doctor: { name: 'CRM-LEAD-002', mobile_no: '+91 90000 00000' } },
    })
    expect(wrapper.text()).toContain('CRM-LEAD-002') // title || name
    expect(wrapper.text()).not.toContain('MG Road')
    expect(wrapper.text()).not.toContain('::')
  })

  it('formats a far distance in kilometres and omits distance when unknown', () => {
    const km = mountTatva(TatvaDoctorCard, { props: { doctor: { ...baseDoctor, distance_m: 2500 } } })
    expect(km.text()).toContain('2.5 km')

    const none = mountTatva(TatvaDoctorCard, { props: { doctor: { ...baseDoctor, distance_m: null } } })
    expect(none.text()).not.toContain(' m')
    expect(none.text()).not.toContain(' km')
  })

  it('emits select with the doctor when the card body is clicked', async () => {
    const wrapper = mountTatva(TatvaDoctorCard, { props: { doctor: baseDoctor } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')[0][0]).toMatchObject({ name: 'CRM-LEAD-001' })
  })

  it('emits call and directions from the action buttons', async () => {
    const wrapper = mountTatva(TatvaDoctorCard, { props: { doctor: baseDoctor } })
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click') // Call
    await buttons[1].trigger('click') // Directions
    expect(wrapper.emitted('call')).toHaveLength(1)
    expect(wrapper.emitted('directions')).toHaveLength(1)
    // Body-click is stopped on the action column, so neither button leaks a select.
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('disables call without a number and directions without coordinates', () => {
    const wrapper = mountTatva(TatvaDoctorCard, {
      props: { doctor: { name: 'CRM-LEAD-003', stage: 'New' } },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('disabled')).toBeDefined() // no mobile_no
    expect(buttons[1].attributes('disabled')).toBeDefined() // no lat/lng
  })
})
