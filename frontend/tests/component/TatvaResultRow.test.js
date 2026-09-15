// Purpose: the result row owns how a badge and a person are drawn, and hides both below `md` with CSS alone.
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import TatvaResultRow from '@/tatva/TatvaResultRow.vue'

// Tooltip needs its provider in the app; inline here, so the avatar it wraps is what is asserted.
const stubs = { Tooltip: { template: '<span data-stub="Tooltip"><slot /></span>' } }
const mount = (props) =>
  mountTatva(TatvaResultRow, {
    props,
    slots: { title: 'Ramesh Kumar', meta: '+919876543210' },
    global: { stubs },
  })

describe('TatvaResultRow', () => {
  it('draws the badge beside the title and the person as an initial beside the meta', () => {
    const wrapper = mount({ badge: 'Call Back', person: 'Shreenika BS' })
    expect(wrapper.text()).toContain('Call Back')
    expect(wrapper.find('[data-stub="Tooltip"]').text()).toBe('S')
  })

  it('hides both below md by CSS, so a phone row never measures its width in JS', () => {
    const wrapper = mount({ badge: 'Call Back', person: 'Shreenika BS' })
    const asides = wrapper.findAll('.hidden.md\\:flex')
    expect(asides).toHaveLength(2)
    expect(asides[0].text()).toContain('Call Back')
  })

  it('draws neither when the caller passes none', () => {
    const wrapper = mount({})
    expect(wrapper.findAll('.hidden.md\\:flex')).toHaveLength(0)
    expect(wrapper.find('[data-stub="Tooltip"]').exists()).toBe(false)
  })
})
