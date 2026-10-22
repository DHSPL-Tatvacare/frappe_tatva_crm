// Purpose: the ONE Directions · Call · WhatsApp · Open lead row (hover card + detail panel) emits each intent with the
// doctor, and an action the doctor cannot support is absent — never offered and then refused.
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import DoctorActions from '@/tatva/nearme/DoctorActions.vue'

const doctor = {
  name: 'CRM-LEAD-001',
  mobile_no: '9000000001',
  mobile_e164: '+919000000001',
  lat: 12.97,
  lng: 77.59,
}

describe('DoctorActions', () => {
  it('emits directions, call, whatsapp and open with the doctor', async () => {
    const wrapper = mountTatva(DoctorActions, { props: { doctor } })
    for (const b of wrapper.findAll('button')) await b.trigger('click')
    for (const e of ['directions', 'call', 'whatsapp', 'open']) {
      expect(wrapper.emitted(e)[0][0]).toMatchObject({ name: 'CRM-LEAD-001' })
    }
  })

  it('drops Directions without coordinates, and Call and WhatsApp without a number', () => {
    const wrapper = mountTatva(DoctorActions, {
      props: { doctor: { name: 'CRM-LEAD-002' } },
    })
    expect(wrapper.findAll('button')).toHaveLength(1) // Open lead needs nothing from the doctor
  })

  it('links WhatsApp to the stored-form number, never a guessed country', async () => {
    const { whatsappUrl } = await import('@/tatva/nearme/doctorMeta')
    expect(whatsappUrl(doctor)).toBe('https://wa.me/919000000001')
    expect(whatsappUrl({ mobile_no: '9000000001' })).toBe('') // no stored form, no link
  })

  it('hands the stops to the Maps app in visiting order, ending at the last', async () => {
    const { routeUrl } = await import('@/tatva/nearme/doctorMeta')
    const url = new URL(
      routeUrl({ lat: 1, lng: 2 }, [
        { lat: 3, lng: 4 },
        { lat: 5, lng: 6 },
        { lat: 7, lng: 8 },
      ]),
    )
    expect(url.searchParams.get('origin')).toBe('1,2')
    expect(url.searchParams.get('waypoints')).toBe('3,4|5,6')
    expect(url.searchParams.get('destination')).toBe('7,8')
  })
})
