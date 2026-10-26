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
import { createPinia } from 'pinia'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod, server, http, HttpResponse } from './_msw.js'

const { default: GlobalSearch } = await import('@/components/GlobalSearch.vue')
const { showGlobalSearch } = await import('@/composables/settings')
const { leadHandle } = await import('@/tatva/palette/published')

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

beforeEach(() => {
  vi.useFakeTimers()
  // The panel's store asks for these on open. Unmocked they escape as unhandled rejections, which vitest
  // exits non-zero on even when every test passes — the shape `onUnhandledRequest: 'error'` exists to catch.
  mockFrappeMethod('tatva_connect.smartview.api.get_smart_views', [])
  mockFrappeMethod('tatva_connect.search.shortcuts.shortcuts', { shortcuts: [] })
  // The Account group asks the check-in card once; switched off, it offers no availability row.
  mockFrappeMethod('tatva_connect.api.checkin.get_status', { enabled: false })
})

afterEach(() => {
  // The open-watcher is code under test, so every test must start from a closed spotlight.
  showGlobalSearch.value = false
  vi.useRealTimers()
})

// Mount FIRST, then open. Setting the shared ref before mounting meant the open-watcher (clear + cancel + focus)
// never ran in a single test — exactly the code the cancel guard lives in. One mount per test, never two.
async function open() {
  // GlobalSearch reads a Pinia setup-store now; a bare mount installs none, so every test died in setup.
  const wrapper = mountTatva(GlobalSearch, {
    global: { stubs: { RouterLink: true }, plugins: [createPinia()] },
  })
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
    // Read-only: nothing to click, nothing to remove — asked of the LINE, not of every button in the
    // dialog, which counts the surface tabs the panel grew and says nothing about this component.
    expect(wrapper.findComponent({ name: 'SearchInterpretation' }).findAll('button')).toHaveLength(0)
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
    expect(wrapper.text()).not.toContain('Searching')
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
    expect(wrapper.text()).not.toContain('Kavita')
  })
})

describe('GlobalSearch drill-down and context', () => {
  // Helpdesk's model: a capped kind drills into all of its rows, the level starts with an empty box, and ⌫ on an empty box steps back out.
  it('drills a capped kind into every row of it, and steps back on backspace', async () => {
    const bodies = []
    const five = Array.from({ length: 5 }, (_, i) => ({ ...RESULTS[0], name: `lead-${i}`, title: `Kavita ${i}` }))
    server.use(
      http.post(PATH, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ message: { results: five, total: 7, totals: { 'CRM Lead': 7 }, status: 'ready' } })
      }),
    )
    const wrapper = await open()
    await type(wrapper, 'kavita')
    expect(wrapper.text()).toContain('Show all 7')

    const input = wrapper.find('input')
    for (let i = 0; i < 5; i++) await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(bodies.at(-1)).toMatchObject({ query: 'kavita', type: 'CRM Lead', limit: 100 })
    expect(input.element.value).toBe('')
    expect(wrapper.find('button').text()).toContain('Leads')

    await input.trigger('keydown', { key: 'Backspace' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Kavita 0')
    expect(showGlobalSearch.value).toBe(true)
  })

  // RED on the first port: the highlight stayed on the row that led when the palette opened ("Dashboard"), so Enter after typing opened it, not the patient that ranked above it.
  it('hands the highlight to the best match once the results land, unless a row was chosen', async () => {
    mockFrappeMethod(METHOD, {
      results: [{ doctype: 'CRM Lead', name: 'lead-d', lead: 'lead-d', title: 'Dash Kumar', snippet: '' }],
      total: 1,
      status: 'ready',
    })
    const wrapper = await open()
    await type(wrapper, 'dash')
    const active = wrapper.find('[role="option"][aria-selected="true"]')
    expect(active.text()).toContain('Dash Kumar')
    expect(wrapper.text()).toContain('Dashboard')
  })

  // The open lead's rows run the page's own handlers: the palette picks, the page writes.
  it("puts the open lead's actions first, and a stage pick goes through the page's own path", async () => {
    const picked = []
    const stages = [
      { name: 'P::New', stage: 'New', display_label: 'New', color: 'gray' },
      { name: 'P::Follow-up', stage: 'Follow-up', display_label: 'Follow-up', color: 'blue' },
    ]
    leadHandle.value = {
      id: 'lead-9',
      title: () => 'Asha Rao',
      stage: () => 'P::New',
      missing: () => false,
      stages: () => stages,
      setStage: (name) => picked.push(name),
      assignees: () => [],
      addAssignee: () => {},
      canCall: () => false,
      email: () => {},
      tabs: () => [],
      tabIndex: () => 0,
      goToTab: () => {},
      canConvert: () => false,
      peek: () => null,
    }
    mockFrappeMethod(METHOD, { results: [], total: 0, status: 'ready' })
    // Nobody covers this lead's grain, so the palette offers no shortcut to take it.
    mockFrappeMethod('tatva_connect.lead.leads.assignable_users', [])
    const wrapper = await open()
    expect(wrapper.text()).toContain('Asha Rao')
    expect(wrapper.text()).not.toContain('Assign to me')
    expect(wrapper.text()).toContain('Change stage')
    expect(wrapper.text()).not.toContain('Call')

    // Typing a stage reveals its flat row; Enter on it sets the stage without the picker.
    await type(wrapper, 'follow')
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(picked).toEqual(['P::Follow-up'])
    expect(showGlobalSearch.value).toBe(false)
    leadHandle.value = null
  })
})
