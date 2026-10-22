// Purpose: one doctor row in the Near Me list is pure presentation — it must surface the doctor's name,
// the `stage · distance · grain` meta line and the address, emit `select` from the body, and offer a call
// only where one can be placed. An action the doctor cannot support is ABSENT, not disabled.
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
  it('renders name, the dot-separated meta line, address and a metres distance', () => {
    const wrapper = mountTatva(TatvaDoctorCard, { props: { doctor: baseDoctor } })
    expect(wrapper.text()).toContain('Dr. Asha Rao')
    expect(wrapper.text()).toContain('Engaged · 450 m · ZZ Care::ZZ Group::ZZ Program') // one meta line
    expect(wrapper.text()).toContain('12 MG Road, Bengaluru')
    expect(wrapper.text()).toContain('ZZ Care::ZZ Group::ZZ Program')
    expect(wrapper.text()).toContain('450 m') // distance_m < 1000 -> metres
  })

  it('shows a composite stage by its title from the reply, never its `::` key', () => {
    const doctor = { ...baseDoctor, stage: 'ZZ Program::Engaged', stage_doctype: 'CRM Lead Stage' }
    const territory = { data: { _link_titles: { 'CRM Lead Stage::ZZ Program::Engaged': 'Engaged' } } }
    const text = mountTatva(TatvaDoctorCard, { props: { doctor, territory } }).text()
    expect(text).toContain('Engaged · 450 m')
    expect(text).not.toContain('ZZ Program::Engaged')
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
    // The template opens with a comment, so the component is multi-root and `wrapper` is the mounting
    // container. The card is the first div, and clicking it is what a rep does.
    await wrapper.find('div').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect(wrapper.emitted('select')[0][0]).toMatchObject({ name: 'CRM-LEAD-001' })
  })

  it('offers only a one-tap call, and only when callable and the doctor has a number', async () => {
    // Directions and Open lead live in the detail panel and the hover card (TatvaDoctorActions).
    expect(mountTatva(TatvaDoctorCard, { props: { doctor: baseDoctor } }).findAll('button')).toHaveLength(0)
    const noNumber = { ...baseDoctor, mobile_no: '' }
    expect(mountTatva(TatvaDoctorCard, { props: { doctor: noNumber, callable: true } }).findAll('button')).toHaveLength(0)

    const wrapper = mountTatva(TatvaDoctorCard, { props: { doctor: baseDoctor, callable: true } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('call')).toHaveLength(1)
    // The call is stopped at the button, so it never also opens the detail.
    expect(wrapper.emitted('select')).toBeUndefined()
  })
})
