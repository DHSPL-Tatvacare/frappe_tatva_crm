// Purpose: the list view mounts only the rows in its scroll window, and everything that reads the list
// as DATA (selection, grouping, filtering) keeps seeing all of it. These assertions guard the window
// wiring: the scroll container is bound for the component's whole life (so Group By -> List cannot
// strand it on a node that is gone), group headers ride the same window as rows, and a filter that
// shortens the list re-ranges instead of blanking.
import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { ListView } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import ListRows from '@/components/ListViews/ListRows.vue'

const VIEWPORT = 800

const Harness = {
  components: { ListView, ListRows },
  props: {
    rows: { type: Array, required: true },
    rowKey: { type: String, default: 'name' },
  },
  template: `
    <ListView :columns="columns" :rows="rows" :row-key="rowKey" ref="listView">
      <ListRows v-slot="{ item }" :rows="rows" doctype="Test Doctype">
        <div class="cell">{{ item }}</div>
      </ListRows>
    </ListView>
  `,
  computed: {
    columns: () => [{ label: 'Name', key: 'name' }],
  },
}

const flatRows = (n, key = 'name') =>
  Array.from({ length: n }, (_, i) => ({ [key]: `row-${i}`, name: `row-${i}` }))

const groupedRows = (groups, per) =>
  Array.from({ length: groups }, (_, g) => ({
    group: `g-${g}`,
    label: `Group ${g}`,
    rows: Array.from({ length: per }, (_, i) => ({ name: `row-${g}-${i}` })),
  }))

// happy-dom does no layout, so the window would size itself from a zero-height container. The viewport
// is declared here the way a browser would report it.
async function mountList(props, component = Harness) {
  const wrapper = mountTatva(component, { props, attachTo: document.body })
  await nextTick()
  const el = wrapper.find('.overflow-y-auto').element
  Object.defineProperty(el, 'clientHeight', {
    value: VIEWPORT,
    configurable: true,
  })
  el.dispatchEvent(new Event('scroll'))
  await nextTick()
  return { wrapper, el }
}

const renderedRows = (wrapper) => wrapper.findAll('.cell').length

describe('ListRows windowing', () => {
  it('mounts a window, not every loaded row', async () => {
    const { wrapper } = await mountList({ rows: flatRows(1000) })
    const shown = renderedRows(wrapper)
    expect(shown).toBeGreaterThan(0)
    expect(shown).toBeLessThan(60)
  })

  it('keeps drawing a full window after Group By and back', async () => {
    const { wrapper, el } = await mountList({ rows: groupedRows(5, 20) })
    expect(wrapper.text()).toContain('Group 0')

    await wrapper.setProps({ rows: flatRows(1000) })
    el.scrollTop = 20000
    el.dispatchEvent(new Event('scroll'))
    await nextTick()

    // The window has to follow the scroll, not just be non-empty: a container bound once at mount is
    // stranded on the grouped branch's node and stays frozen on the first screenful forever.
    expect(wrapper.text()).toContain('row-500')
    expect(wrapper.text()).not.toContain('row-0 ')
  })

  it('windows a grouped list too, headers riding the same window', async () => {
    const { wrapper } = await mountList({ rows: groupedRows(20, 50) })
    expect(renderedRows(wrapper)).toBeGreaterThan(0)
    expect(renderedRows(wrapper)).toBeLessThan(60)
    expect(wrapper.text()).toContain('Group 0')
  })

  it('drops a collapsed group\u2019s rows from the window', async () => {
    const { wrapper, el } = await mountList({ rows: groupedRows(3, 20) })
    expect(wrapper.text()).toContain('row-0-0')

    // Driven through the real `ListGroupHeader` toggle: it mutates the group it was handed, which is the
    // reactive proxy the window reads. Poking the raw prop object would not be the path the app takes.
    await wrapper.findAll('button')[0].trigger('click')
    el.dispatchEvent(new Event('scroll'))
    await nextTick()

    // The header stays, its rows leave, and the window backfills from the groups below — so the count
    // alone proves nothing; what the window is showing does.
    expect(wrapper.text()).toContain('Group 0')
    expect(wrapper.text()).not.toContain('row-0-0')
    expect(wrapper.text()).toContain('row-1-0')
  })

  it('re-ranges instead of blanking when a filter shortens the list', async () => {
    const { wrapper, el } = await mountList({ rows: flatRows(1000) })
    el.scrollTop = 30000
    el.dispatchEvent(new Event('scroll'))
    await nextTick()

    await wrapper.setProps({ rows: flatRows(3) })
    await nextTick()
    expect(renderedRows(wrapper)).toBe(3)
  })
})

describe('ListRows keeps the list readable as data', () => {
  it('selects every row while only a window is mounted', async () => {
    const { wrapper } = await mountList({ rows: flatRows(1000) })
    expect(renderedRows(wrapper)).toBeLessThan(60)

    wrapper.vm.$refs.listView.toggleAllRows(true)
    await nextTick()
    expect(wrapper.vm.$refs.listView.selections.size).toBe(1000)
    expect(wrapper.vm.$refs.listView.allRowsSelected).toBe(true)
  })

  it('keys rows off the row-key ListView declares, not a hardcoded name', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rows = Array.from({ length: 50 }, (_, i) => ({
      reference_docname: `doc-${i}`,
    }))
    const { wrapper } = await mountList({ rows, rowKey: 'reference_docname' })
    await wrapper.setProps({ rows: rows.slice(0, 40) })
    await nextTick()
    expect(
      warn.mock.calls.some((c) => String(c[0]).includes('Duplicate keys')),
    ).toBe(false)
    warn.mockRestore()
  })
})
