// Purpose: the spotlight shows what the SERVER understood of the typed words — a muted, read-only line, and
// nothing at all when the server resolved nothing (which is the dormant path and today's product). The line is
// rendered from the existing search resource; there is no second request and no client-side parsing. Data is
// mocked at the network layer with MSW, so this drives the real createResource path.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'

// `useKeyboardShortcuts` reaches `utils/dialogs.jsx`, and vitest 4's own vite transforms .jsx with the React
// runtime whatever `vueJsx()` says — a pre-existing toolchain limit, nothing to do with the spotlight. Mocked
// so the module is never transformed; ⌘K is not what this file asserts.
vi.mock('@/composables/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => {} }))

const { default: GlobalSearch } = await import('@/components/GlobalSearch.vue')
const { showGlobalSearch } = await import('@/composables/settings')

const RESULTS = [{ doctype: 'CRM Lead', name: 'lead-1', lead: 'lead-1', title: 'Kavita', snippet: '+91900000001' }]

const understood = {
  filters: [
    { column: 'vertical', label: 'Product Line', value: 'Onco' },
    { column: 'status', label: 'Stage', value: 'Active' },
  ],
  text: 'kavita',
}

async function type(query, payload) {
  mockFrappeMethod('tatva_connect.search.api.search', payload)
  showGlobalSearch.value = true
  const wrapper = mountTatva(GlobalSearch, { global: { stubs: { RouterLink: true } } })
  await wrapper.find('input').setValue(query)
  // createResource debounces the submit by 250ms.
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
  return wrapper
}

describe('GlobalSearch interpretation line', () => {
  it("reads back the server's filters and the words left for text", async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await type('onco active kavita', { results: RESULTS, total: 1, status: 'ready', understood })
      const text = wrapper.text()
      expect(text).toContain('Product Line: Onco')
      expect(text).toContain('Stage: Active')
      expect(text).toContain('kavita')
      // Read-only: nothing to click, nothing to remove.
      expect(wrapper.findAll('button').length).toBe(RESULTS.length)
    } finally {
      vi.useRealTimers()
    }
  })

  it('draws no line when the server resolved nothing — the dormant path', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await type('kavita', { results: RESULTS, total: 1, status: 'ready' })
      expect(wrapper.text()).not.toContain('Product Line')
      expect(wrapper.text()).not.toContain('·')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a capped total as a floor, never as an exact count', async () => {
    vi.useFakeTimers()
    try {
      const capped = await type('status', { results: RESULTS, total: 100, status: 'ready', total_capped: true })
      expect(capped.text()).toContain('100+')
      const exact = await type('kavita', { results: RESULTS, total: 1, status: 'ready', total_capped: false })
      expect(exact.text()).not.toContain('1+')
    } finally {
      vi.useRealTimers()
    }
  })
})
