// Purpose: ONE lead cell for Tasks, Call Logs and Notes. It must be a real anchor with a real href and
// target="_blank" — the pop-out arrow has to mean what it draws, and an anchor is what makes Cmd-click and
// middle-click work with no code. The Notes version it replaces was a <button> calling router.push, so the
// arrow lied and opened in the same tab. It must also show the PERSON'S NAME the list already shipped in
// `_link_titles`, never `CRM-LEAD-2026-00123`, and its click must not fall through to the row.
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountTatva } from './_mount.js'
import LeadCell from '@/tatva/LeadCell.vue'
import LeadPreview from '@/tatva/LeadPreview.vue'

// The real Popover mounts its body only while open, so the stub renders the target alone and records `show`.
const PopoverStub = {
  name: 'Popover',
  props: { show: { type: Boolean, default: undefined } },
  template: '<div data-stub="Popover"><slot name="target" /></div>',
}

const blank = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/leads/:leadId', name: 'Lead', component: blank },
    { path: '/deals/:dealId', name: 'Deal', component: blank },
  ],
})

const column = {
  label: 'Lead',
  type: 'Dynamic Link',
  key: 'reference_docname',
  options: 'reference_doctype',
}

const list = {
  data: {
    _link_titles: {
      'CRM Lead::CRM-LEAD-2026-00123': 'Anaya Sharma',
      'CRM Deal::CRM-DEAL-2026-00007': 'Sharma Renewal',
    },
  },
}

const leadRow = {
  name: 'TASK-1',
  reference_doctype: 'CRM Lead',
  reference_docname: 'CRM-LEAD-2026-00123',
}

function mountCell(props = {}) {
  return mountTatva(LeadCell, {
    props: {
      value: 'CRM-LEAD-2026-00123',
      column,
      row: leadRow,
      list,
      ...props,
    },
    global: { plugins: [router], stubs: { Popover: PopoverStub } },
  })
}

describe('LeadCell', () => {
  it('is an anchor to the lead route that opens in a new tab', () => {
    const a = mountCell().get('a')
    expect(a.attributes('href')).toBe('/leads/CRM-LEAD-2026-00123')
    expect(a.attributes('target')).toBe('_blank')
  })

  it("shows the person's name from the list's _link_titles, never the record id", () => {
    const wrapper = mountCell()
    expect(wrapper.text()).toContain('Anaya Sharma')
    expect(wrapper.text()).not.toContain('CRM-LEAD-2026-00123')
  })

  it('reads as a badge: person icon, a TRUNCATING name, pop-out arrow', () => {
    const wrapper = mountCell()
    // Badge's own shell — rounded-full is what makes it a chip rather than blue text.
    expect(wrapper.get('a > div').classes()).toContain('rounded-full')
    // Badge is whitespace-nowrap and does not truncate; the name must carry it itself.
    expect(wrapper.get('span.truncate').text()).toBe('Anaya Sharma')
    // #prefix and #suffix each render one icon.
    expect(wrapper.findAll('svg').length).toBe(2)
  })

  it('does not draw the control hover-only — it must be reachable on touch (H3)', () => {
    expect(mountCell().html()).not.toContain('opacity-0')
  })

  it('a click on the cell does not fall through to the row', async () => {
    const onRowClick = vi.fn()
    const wrapper = mountTatva(
      {
        components: { LeadCell },
        setup: () => () =>
          h('div', { onClick: onRowClick }, [
            h(LeadCell, {
              value: 'CRM-LEAD-2026-00123',
              column,
              row: leadRow,
              list,
            }),
          ]),
      },
      { global: { plugins: [router], stubs: { Popover: PopoverStub } } },
    )
    // The anchor is real, so happy-dom really tries to open the href and logs a connection error to
    // stderr after the assertion. That noise is the proof this is a genuine link, not a styled button.
    await wrapper.get('a').trigger('click')
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('a deal reference routes to the Deal page, read off the row', () => {
    const wrapper = mountCell({
      value: 'CRM-DEAL-2026-00007',
      row: {
        name: 'TASK-2',
        reference_doctype: 'CRM Deal',
        reference_docname: 'CRM-DEAL-2026-00007',
      },
    })
    expect(wrapper.get('a').attributes('href')).toBe(
      '/deals/CRM-DEAL-2026-00007',
    )
    expect(wrapper.text()).toContain('Sharma Renewal')
  })

  it('falls back to the raw key when the map carries no title', () => {
    const wrapper = mountCell({ value: 'CRM-LEAD-9999', list: { data: {} } })
    expect(wrapper.text()).toContain('CRM-LEAD-9999')
  })

  it('renders nothing when the row has no reference', () => {
    expect(mountCell({ value: '' }).find('a').exists()).toBe(false)
  })

  it('a rendered cell mounts no card, so a list load fetches nothing', () => {
    expect(mountCell().findComponent(LeadPreview).exists()).toBe(false)
  })

  it('a CRM Lead row on desktop leaves the Popover free to open', () => {
    expect(mountCell().findComponent(PopoverStub).props('show')).toBeUndefined()
  })

  it('a Deal row holds the Popover shut — only a lead has a card', () => {
    const w = mountCell({ row: { ...leadRow, reference_doctype: 'CRM Deal', reference_docname: 'CRM-DEAL-2026-00007' } })
    expect(w.findComponent(PopoverStub).props('show')).toBe(false)
  })
})
