// Purpose: the spotlight shows what the SERVER understood of the typed words — a muted, read-only line, and
// nothing at all when the server resolved nothing (which is the dormant path and today's product). The line is
// rendered from the existing search resource; there is no second request and no client-side parsing. Data is
// mocked at the network layer with MSW, so this drives the real createResource path.
//
// It also owns the two lifecycle rules the panel lives or dies by: a response may only paint if the box still
// reads the query that asked for it, and a close or a cleared box must cancel what is armed. Both were invisible
// here before, for two harness reasons now fixed: the ref was flipped BEFORE mounting (so the open-watcher never
// ran in any test), and MSW bypassed unmocked requests (so a late or empty-query request was silently swallowed).
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod, server, http, HttpResponse } from './_msw.js'

// `useKeyboardShortcuts` reaches `utils/dialogs.jsx`, and vitest 4's own vite transforms .jsx with the React
// runtime whatever `vueJsx()` says — a pre-existing toolchain limit, nothing to do with the spotlight. Mocked
// so the module is never transformed; ⌘K is not what this file asserts.
vi.mock('@/composables/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => {} }))

const { default: GlobalSearch } = await import('@/components/GlobalSearch.vue')
const { showGlobalSearch } = await import('@/composables/settings')

const METHOD = 'tatva_connect.search.api.search'
const PATH = `*/api/method/${METHOD}`

const RESULTS = [{ doctype: 'CRM Lead', name: 'lead-1', lead: 'lead-1', title: 'Kavita', snippet: '+91900000001' }]

const understood = {
  filters: [
    { column: 'vertical', label: 'Product Line', value: 'Onco' },
    { column: 'status', label: 'Stage', value: 'Active' },
  ],
  text: 'kavita',
}

// _msw.js declares that an unmocked request is a defect; `bypass` is what made that declaration a lie. No
// afterAll restore is needed — vitest isolates each test file's module registry, so this server is ours alone.
beforeAll(() => {
  server.close()
  server.listen({ onUnhandledRequest: 'error' })
})

beforeEach(() => vi.useFakeTimers())

afterEach(() => {
  // The open-watcher is code under test, so every test must start from a closed spotlight.
  showGlobalSearch.value = false
  vi.useRealTimers()
})

// Mount FIRST, then open. Setting the shared ref before mounting meant the open-watcher (clear + cancel + focus)
// never ran in a single test — exactly the code the cancel guard lives in. One mount per test, never two.
async function open() {
  const wrapper = mountTatva(GlobalSearch, { global: { stubs: { RouterLink: true } } })
  showGlobalSearch.value = true
  await flushPromises()
  return wrapper
}

// The wait before a request is 250ms; 400 clears it and lets the response settle.
async function type(wrapper, text) {
  await wrapper.find('input').setValue(text)
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

// A handler that counts what actually reached the network, for the two cancellation proofs.
function countingHandler(counter) {
  server.use(
    http.post(PATH, () => {
      counter.calls += 1
      return HttpResponse.json({ message: { results: [], total: 0, status: 'ready' } })
    }),
  )
}

describe('GlobalSearch interpretation line', () => {
  it("reads back the server's filters and the words left for text", async () => {
    mockFrappeMethod(METHOD, { results: RESULTS, total: 1, status: 'ready', understood })
    const wrapper = await open()
    await type(wrapper, 'onco active kavita')
    const text = wrapper.text()
    expect(text).toContain('Product Line: Onco')
    expect(text).toContain('Stage: Active')
    expect(text).toContain('kavita')
    // Read-only: nothing to click, nothing to remove.
    expect(wrapper.findAll('button').length).toBe(RESULTS.length)
  })

  it('draws no line when the server resolved nothing — the dormant path', async () => {
    mockFrappeMethod(METHOD, { results: RESULTS, total: 1, status: 'ready' })
    const wrapper = await open()
    await type(wrapper, 'kavita')
    expect(wrapper.text()).not.toContain('Product Line')
    expect(wrapper.text()).not.toContain('·')
  })

  it('reports a capped total as a floor, never as an exact count', async () => {
    mockFrappeMethod(METHOD, { results: RESULTS, total: 100, status: 'ready', total_capped: true })
    const wrapper = await open()
    await type(wrapper, 'status')
    expect(wrapper.text()).toContain('100+')
  })

  it('reports an uncapped total exactly', async () => {
    mockFrappeMethod(METHOD, { results: RESULTS, total: 1, status: 'ready', total_capped: false })
    const wrapper = await open()
    await type(wrapper, 'kavita')
    expect(wrapper.text()).not.toContain('1+')
  })
})

describe('GlobalSearch request lifecycle', () => {
  // RED on the old component: createResource assigns out.data unconditionally, so the slow "ab" answer landed
  // last and won — the list said one patient while the box said another. Nothing here mocks the resource.
  it('refuses a stale response that lands after a newer query', async () => {
    let releaseStale
    server.use(
      http.post(PATH, async ({ request }) => {
        const { query } = await request.json()
        const stale = query === 'ab'
        if (stale) await new Promise((resolve) => (releaseStale = resolve))
        return HttpResponse.json({
          message: {
            results: [
              { doctype: 'CRM Lead', name: query, lead: query, title: stale ? 'Stale Answer' : 'Fresh Answer', snippet: '' },
            ],
            total: 1,
            status: 'ready',
          },
        })
      }),
    )
    const wrapper = await open()
    await type(wrapper, 'ab')
    await type(wrapper, 'abc')
    expect(wrapper.text()).toContain('Fresh Answer')
    releaseStale()
    await flushPromises()
    await nextTick()
    expect(wrapper.text()).toContain('Fresh Answer')
    expect(wrapper.text()).not.toContain('Stale Answer')
  })

  // RED on the old component: reset() touches no timer, and makeParams is evaluated AFTER the wait — so the
  // armed request fired with an empty query the endpoint had already been told nothing about.
  it('sends nothing at all for a box that was cleared before the request fired', async () => {
    const counter = { calls: 0 }
    countingHandler(counter)
    const wrapper = await open()
    await wrapper.find('input').setValue('ram')
    await wrapper.find('input').setValue('')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(counter.calls).toBe(0)
    expect(wrapper.text()).toContain('Type to search')
  })

  // RED on the old component: the same armed request landed inside a freshly reopened, empty spotlight.
  it('cancels an armed request when the spotlight closes inside the wait', async () => {
    const counter = { calls: 0 }
    countingHandler(counter)
    const wrapper = await open()
    await wrapper.find('input').setValue('ram')
    showGlobalSearch.value = false
    await flushPromises()
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(counter.calls).toBe(0)
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('opens empty every time, carrying no rows over from the last search', async () => {
    mockFrappeMethod(METHOD, { results: RESULTS, total: 1, status: 'ready' })
    const wrapper = await open()
    await type(wrapper, 'kavita')
    expect(wrapper.text()).toContain('Kavita')
    showGlobalSearch.value = false
    await flushPromises()
    showGlobalSearch.value = true
    await flushPromises()
    expect(wrapper.find('input').element.value).toBe('')
    expect(wrapper.text()).toContain('Type to search')
    expect(wrapper.text()).not.toContain('Kavita')
  })
})
