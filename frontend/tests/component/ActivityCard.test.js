// Purpose: ActivityCard is the ONE shape for the activity type tabs AND the Activity rail (U9). Four slots —
// optional leading type-icon tile · title + ONE primary badge + an icon-only corner · one flavor line · a
// muted foot (actor · when). `showTypeIcon=false` is RAIL MODE: no tile, no foot attribution (the rail
// header carries it) — and therefore NO FOOT ROW AT ALL, which is what keeps a file card the same height
// as the note card beside it. It stays DUMB (U11): a body click emits `open`, an overflow item emits
// `action(key)`, nothing else. These are the contracts every adapter and the rail rely on.
import { describe, it, expect, vi } from 'vitest'
import { mountTatva } from './_mount.js'

vi.mock('@/utils', () => ({
  formatDate: (d) => `full:${d}`,
  timeAgo: () => '58m ago',
}))

import ActivityCard from '@/tatva/ActivityCard.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'

const base = {
  title: 'First cycle order punch',
  actor: { label: 'Malan Begum', image: '' },
  at: '2026-07-25 11:11:00',
}

describe('ActivityCard', () => {
  it('renders title, primary badge, flavor line and the who/when foot', () => {
    const wrapper = mountTatva(ActivityCard, {
      props: {
        ...base,
        tile: { kind: 'icon', icon: TaskIcon, tint: 'blue' },
        badge: { label: 'Completed', theme: 'green' },
        flavor: '07 Aug · 11:12 AM · 15m',
      },
    })
    const text = wrapper.text()
    expect(text).toContain('First cycle order punch')
    expect(text).toContain('Completed')
    expect(text).toContain('07 Aug · 11:12 AM · 15m') // the ONE flavor line
    expect(text).toContain('Malan Begum')
    expect(text).toContain('58m ago')
  })

  it('renders a thumbnail tile for image attachments instead of an icon', () => {
    const wrapper = mountTatva(ActivityCard, {
      props: { ...base, tile: { kind: 'thumb', src: 'blob:x' }, title: 'scan.png' },
    })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('blob:x')
  })

  it('renders the corner as icon-only indicators (no labels)', () => {
    const wrapper = mountTatva(ActivityCard, {
      props: { ...base, showTypeIcon: false, corner: [{ icon: 'map-pin', tooltip: 'Location captured' }, { icon: 'lock', tooltip: 'Private' }] },
    })
    // The corner cluster renders; the tooltip labels are NOT shown as body text (icon-only).
    expect(wrapper.findAll('svg').length).toBeGreaterThanOrEqual(2)
    expect(wrapper.text()).not.toContain('Location captured')
  })

  it('a corner does NOT give a rail card an extra row', () => {
    // THE defect: in rail mode the foot rendered for the corner alone, so an attachment card grew a third,
    // empty row and sat taller than the note card beside it — a lock stranded at the bottom right.
    const withCorner = mountTatva(ActivityCard, {
      props: { ...base, showTypeIcon: false, flavor: 'PDF · 2.97 MB', corner: [{ icon: 'lock', tooltip: 'Private' }] },
    })
    const withoutCorner = mountTatva(ActivityCard, {
      props: { ...base, showTypeIcon: false, flavor: 'order no 568c6' },
    })
    // Same number of rows in the body: title row + flavor line, and nothing else.
    const rows = (w) => w.find('.min-w-0.flex-1').element.children.length
    expect(rows(withCorner)).toBe(rows(withoutCorner))
  })

  it('rail mode (showTypeIcon=false) drops the tile and the foot attribution', () => {
    const withIcon = mountTatva(ActivityCard, {
      props: { ...base, tile: { kind: 'icon', icon: TaskIcon }, flavor: 'x' },
    })
    expect(withIcon.text()).toContain('Malan Begum') // foot present in tab mode

    const rail = mountTatva(ActivityCard, {
      props: { ...base, showTypeIcon: false, tile: { kind: 'icon', icon: TaskIcon }, flavor: 'x' },
    })
    expect(rail.find('img').exists()).toBe(false)
    expect(rail.text()).not.toContain('Malan Begum') // the rail header carries who/when, not the card
    expect(rail.text()).toContain('First cycle order punch')
  })

  it('emits open on body click', async () => {
    const wrapper = mountTatva(ActivityCard, { props: base })
    await wrapper.trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('maps overflow items to action(key) and never acts itself', () => {
    const DropdownProbe = {
      name: 'DropdownProbe',
      props: { options: { type: Array, default: () => [] } },
      template: '<div data-stub="DropdownProbe"><slot /></div>',
    }
    const wrapper = mountTatva(ActivityCard, {
      props: { ...base, menu: [{ label: 'Delete', icon: 'trash-2', key: 'delete' }] },
      global: { stubs: { Dropdown: DropdownProbe } },
    })
    const opts = wrapper.findComponent(DropdownProbe).props('options')
    opts[0].onClick()
    expect(wrapper.emitted('action')[0]).toEqual(['delete'])
  })

  it('omits badge and menu chrome when not supplied', () => {
    const wrapper = mountTatva(ActivityCard, { props: base })
    expect(wrapper.findComponent({ name: 'DropdownStub' }).exists()).toBe(false)
    expect(wrapper.find('.opacity-60').exists()).toBe(false)
  })

  it('dims a history/canceled card', () => {
    const wrapper = mountTatva(ActivityCard, { props: { ...base, dimmed: true } })
    expect(wrapper.find('.opacity-60').exists()).toBe(true)
  })
})
