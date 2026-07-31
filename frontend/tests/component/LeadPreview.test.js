// Purpose: the hover card must be free until it is open, cheap on every re-open, and silent when it
// fails. Each test below is one of those guarantees, and the last is the one that matters most: a
// frappe-ui `cache:` key calls `saveLocal` on EVERY success (resources.js:104 -> resources/local.ts),
// which writes to IndexedDB with no TTL and no eviction. Keying that per lead would persist patient
// data to the reader's disk, one entry per lead ever hovered, forever. This spec is what stops someone
// later "simplifying" the in-memory memo into a cache key.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `saveLocal`/`getLocal` reach IndexedDB through idb-keyval, whose very first act is `indexedDB.open`
// — and both of them return early when `indexedDB` is undefined, which happy-dom leaves it. So the
// environment is given one, and it is a spy: ANY database access at all, read or write, is a cache key
// that should not exist. Never cleared between tests, so the assertion is order-independent — one
// touch anywhere in this file fails it.
const idbOpen = vi.fn(() => ({ result: null }))
globalThis.indexedDB = { open: idbOpen }

import { flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse, server } from './_msw.js'
import { mountTatva } from './_mount.js'
import LeadCell from '@/tatva/LeadCell.vue'
// usersStore pulls in pinia + vue-router (app context we don't boot). Only getUser is used — the owner
// row — so mock it to a deterministic shape, the same way TaskModal.test.js does.
vi.mock('@/stores/users', () => ({
  usersStore: () => ({ getUser: (email) => ({ full_name: email, user_image: '' }) }),
}))

import LeadPreview from '@/tatva/LeadPreview.vue'
import { leadPreviews } from '@/tatva/leadPreview'

const LEAD = 'CRM-LEAD-2026-00123'
const METHOD = '*/api/method/tatva_connect.api.lead_preview.get_lead_preview'
const CARD = {
  title: 'Anaya Sharma',
  image: '',
  phone: '+919820011223',
  stage: 'Treatment on Hold',
  stage_color: 'orange',
  owner: 'kunjan@tatvacare.in',
  source: 'Enrolment Form',
  grain: [{ label: 'Product Line', value: 'Tatvapractice' }],
}

const blank = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/leads/:leadId', name: 'Lead', component: blank },
    { path: '/deals/:dealId', name: 'Deal', component: blank },
  ],
})

let requests = 0
let release = null

function mockPreview({ fail = false, defer = false } = {}) {
  const respond = async () => {
    requests += 1
    if (defer) await new Promise((resolve) => (release = resolve))
    if (fail) return HttpResponse.json({ exc_type: 'PermissionError' }, { status: 403 })
    return HttpResponse.json({ message: CARD })
  }
  server.use(http.post(METHOD, respond), http.get(METHOD, respond))
}

function mountCard(props = {}) {
  return mountTatva(LeadPreview, { props: { doctype: 'CRM Lead', name: LEAD, ...props } })
}

function mountBadge() {
  return mountTatva(LeadCell, {
    props: {
      value: LEAD,
      column: { type: 'Dynamic Link', key: 'reference_docname', options: 'reference_doctype' },
      row: { name: 'TASK-1', reference_doctype: 'CRM Lead', reference_docname: LEAD },
      list: { data: { _link_titles: { [`CRM Lead::${LEAD}`]: 'Anaya Sharma' } } },
    },
    global: { plugins: [router] },
  })
}

// A real `fetch` through MSW needs macrotasks, not just a microtask drain, so one flush is not enough.
async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

beforeEach(() => {
  requests = 0
  release = null
  // The memo is module-level and outlives a test, exactly as it outlives a card in the browser.
  Object.keys(leadPreviews).forEach((key) => delete leadPreviews[key])
})

// A handler left hanging would keep its key in the in-flight map and silently join the NEXT test to a
// request that never answers. Release it, then let it finish.
afterEach(async () => {
  release?.()
  await settle()
})

describe('LeadPreview', () => {
  it('a rendered badge fetches NOTHING — only an open card does', async () => {
    mockPreview()
    const wrapper = mountBadge()
    await flushPromises()
    expect(requests).toBe(0)
    expect(wrapper.find('a').exists()).toBe(true)
  })

  it('an open card asks once and renders the card it is handed, read-only', async () => {
    mockPreview()
    const wrapper = mountCard()
    await flushPromises()
    expect(requests).toBe(1)
    expect(wrapper.text()).toContain('Owner')
    expect(wrapper.text()).toContain('Tatvapractice')
    expect(wrapper.text()).toContain('Anaya Sharma')
    expect(wrapper.text()).toContain('Treatment on Hold')
    // A surface that appears on mouse-over is never a write surface.
    expect(wrapper.findAll('input, textarea, select, button').length).toBe(0)
  })

  it('a lead already seen paints on the FIRST FRAME and issues nothing', async () => {
    mockPreview()
    mountCard()
    await flushPromises()
    expect(requests).toBe(1)

    const again = mountCard()
    // No await: the memo must answer synchronously in setup, or the card flashes on every re-hover.
    expect(again.text()).toContain('Anaya Sharma')
    await flushPromises()
    expect(requests).toBe(1)
  })

  it('two cards for one lead in flight make ONE request, not two', async () => {
    mockPreview()
    // Both mounted before either can answer: the in-flight join is what makes this one request, and
    // it is decided synchronously in `ensureLeadPreview`, so no deferred response is needed to prove it.
    mountCard()
    mountCard()
    await settle()
    expect(requests).toBe(1)
  })

  it('a refused read settles to a STABLE frame — never collapses under an open tooltip', async () => {
    mockPreview({ fail: true })
    const card = mountCard()
    const badge = mountBadge()
    await settle()
    // The frame stays. Removing it mid-hover is what made a card read as "Loading... flicker... gone":
    // the tooltip stays open, so content that unmounts under it shrinks the box to nothing on screen.
    expect(card.find('div').exists()).toBe(true)
    expect(card.text()).toContain('No preview available')
    // Muted, not an error: no retry, no alert role, nothing that demands attention from a decoration.
    expect(card.find('[role="alert"]').exists()).toBe(false)
    expect(card.findAll('button').length).toBe(0)
    // And no spinner is left behind once the answer (a refusal) has landed.
    expect(card.find('.animate-pulse').exists()).toBe(false)
    // A failure is never memoised — a transient error must not blank the card for the session.
    expect(leadPreviews[LEAD]).toBeUndefined()
    // The badge is exactly what it was before the card was ever opened.
    expect(badge.find('a').exists()).toBe(true)
    expect(badge.text()).toContain('Anaya Sharma')
  })

  it('a card closed mid-flight takes the late response as a no-op', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockPreview({ defer: true })
    const wrapper = mountCard()
    await vi.waitFor(() => expect(requests).toBe(1))
    wrapper.unmount()
    release()
    await settle()
    // No write into a dead component and no unhandled rejection: Vue would warn and Vitest would fail.
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    // The answer still lands in the shared memo, so the next card for this lead paints for free.
    expect(leadPreviews[LEAD]).toEqual(CARD)
    warn.mockRestore()
    error.mockRestore()
  })

  it('persists NOTHING to IndexedDB after a successful preview', async () => {
    mockPreview()
    mountCard()
    await settle()
    // The preview really succeeded — otherwise this asserts nothing.
    expect(leadPreviews[LEAD]).toEqual(CARD)
    expect(idbOpen).not.toHaveBeenCalled()
  })
})
