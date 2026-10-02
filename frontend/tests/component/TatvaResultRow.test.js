// Purpose: the result row owns how a badge is drawn, and hides it below `md` with CSS alone.
import { describe, it, expect } from 'vitest'
import { mountTatva } from './_mount.js'
import TatvaResultRow from '@/tatva/TatvaResultRow.vue'

const mount = (props) =>
  mountTatva(TatvaResultRow, {
    props,
    slots: { title: 'Ramesh Kumar', meta: '+919876543210' },
  })

describe('TatvaResultRow', () => {
  it('draws the badge beside the title, hidden below md by CSS', () => {
    const asides = mount({ badge: 'Call Back' }).findAll('.hidden.md\\:flex')
    expect(asides).toHaveLength(1)
    expect(asides[0].text()).toContain('Call Back')
  })

  it('draws no badge and no person when the caller passes none', () => {
    const wrapper = mount({})
    expect(wrapper.findAll('.hidden.md\\:flex')).toHaveLength(0)
    expect(wrapper.find('.rounded-full').exists()).toBe(false)
  })
})
