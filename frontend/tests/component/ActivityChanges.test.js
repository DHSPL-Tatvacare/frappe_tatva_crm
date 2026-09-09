// Purpose: a save's changes must say what they changed FROM, and a burst must collapse behind a count a
// reader can open — the rail showed "changed Stage" with neither, and native's "+N" expander could never
// render because the server stripped the grouping it needed.
import { describe, expect, it } from 'vitest'
import { mountTatva } from './_mount.js'
import ActivityChanges from '@/tatva/ActivityChanges.vue'

const changes = (n) =>
  Array.from({ length: n }, (_, i) => ({
    label: `Field ${i}`,
    from: `old ${i}`,
    to: `new ${i}`,
  }))

describe('a change', () => {
  it('says where it came from and where it went', () => {
    const w = mountTatva(ActivityChanges, { props: { changes: changes(1) } })

    expect(w.text()).toContain('old 0')
    expect(w.text()).toContain('new 0')
  })

  it('reads as cleared when it went nowhere', () => {
    const w = mountTatva(ActivityChanges, {
      props: { changes: [{ label: 'Stage', from: 'Consulted', to: '' }] },
    })

    expect(w.text()).toContain('(cleared)')
  })

  it('offers no expander for a single change', () => {
    const w = mountTatva(ActivityChanges, { props: { changes: changes(1) } })

    expect(w.find('button').exists()).toBe(false)
  })
})

describe('a burst', () => {
  it('collapses to the first line behind a count', () => {
    const w = mountTatva(ActivityChanges, { props: { changes: changes(4) } })

    expect(w.text()).toContain('Field 0')
    expect(w.text()).not.toContain('Field 3')
    expect(w.find('button').text()).toContain('3')
  })

  it('opens and closes on the count', async () => {
    const w = mountTatva(ActivityChanges, { props: { changes: changes(4) } })

    await w.find('button').trigger('click')
    expect(w.text()).toContain('Field 3')

    await w.find('button').trigger('click')
    expect(w.text()).not.toContain('Field 3')
  })
})
