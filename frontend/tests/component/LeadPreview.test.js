// Purpose: the lead card asks once per lead, renders the server's rows through RecordCard, remembers a refusal, never persists to IndexedDB.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Any IndexedDB access at all would be a frappe-ui `cache:` key persisting patient data; happy-dom has none, so this spy is the only door.
const idbOpen = vi.fn(() => ({ result: null }))
globalThis.indexedDB = { open: idbOpen }

import { flushPromises } from '@vue/test-utils'
import { http, HttpResponse, server } from './_msw.js'
import { mountTatva } from './_mount.js'
import LeadPreview from '@/tatva/LeadPreview.vue'
import RecordCard from '@/tatva/RecordCard.vue'
import { leadPreviews } from '@/tatva/leadPreview'

const LEAD = 'CRM-LEAD-2026-00123'
const METHOD = '*/api/method/tatva_connect.api.lead_preview.get_lead_preview'
const CARD = {
  title: 'Anaya Sharma',
  image: '',
  rows: [
    { label: 'Lead ID', value: LEAD },
    { label: 'Stage', value: 'Treatment on Hold' },
    { label: 'Source Origin', value: '' },
  ],
}

// Each failure is the status and exc_type frappe's `report_error` sends for that exception.
const FAILURES = {
  missing: [{ exc_type: 'DoesNotExistError' }, 404],
  forbidden: [{ exc_type: 'PermissionError' }, 403],
  transient: [{}, 500],
}

let requests = 0
let release = null

function mockPreview({ fail = null, defer = false } = {}) {
  const respond = async () => {
    requests += 1
    if (defer) await new Promise((resolve) => (release = resolve))
    if (fail) return HttpResponse.json(FAILURES[fail][0], { status: FAILURES[fail][1] })
    return HttpResponse.json({ message: CARD })
  }
  server.use(http.post(METHOD, respond))
}

const mountCard = () => mountTatva(LeadPreview, { props: { name: LEAD } })

// A real `fetch` through MSW needs macrotasks, not just a microtask drain.
async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

beforeEach(() => {
  requests = 0
  release = null
  Object.keys(leadPreviews).forEach((key) => delete leadPreviews[key])
})

afterEach(async () => {
  release?.()
  await settle()
})

describe('LeadPreview', () => {
  it('asks once and hands the server payload to RecordCard untouched', async () => {
    mockPreview()
    const wrapper = mountCard()
    await settle()
    expect(requests).toBe(1)
    const card = wrapper.findComponent(RecordCard)
    expect(card.props('title')).toBe(CARD.title)
    expect(card.props('rows')).toEqual(CARD.rows)
    expect(wrapper.findAll('dt').map((dt) => dt.text())).toEqual(['Lead ID', 'Stage', 'Source Origin'])
    expect(wrapper.findAll('dd').at(-1).text()).toBe('—')
  })

  it('offers exactly one action, copy, and no other control', async () => {
    mockPreview()
    const wrapper = mountCard()
    await settle()
    expect(wrapper.findAll('input, textarea, select').length).toBe(0)
    expect(wrapper.findAll('button').map((b) => b.attributes('aria-label'))).toEqual(['Copy Lead ID'])
  })

  it('a lead already seen paints on the FIRST FRAME and issues nothing', async () => {
    mockPreview()
    mountCard()
    await settle()
    const again = mountCard()
    expect(again.text()).toContain('Anaya Sharma')
    await settle()
    expect(requests).toBe(1)
  })

  it('two cards for one lead in flight make ONE request', async () => {
    mockPreview()
    mountCard()
    mountCard()
    await settle()
    expect(requests).toBe(1)
  })

  it.each([
    ['missing', 'Lead does not exist'],
    ['forbidden', 'You are not authorised to view this lead'],
  ])('a %s lead says so, and a re-hover asks NOTHING', async (fail, text) => {
    mockPreview({ fail })
    mountCard()
    await settle()
    const again = mountCard()
    expect(again.text()).toBe(text)
    await settle()
    expect(requests).toBe(1)
    expect(leadPreviews[LEAD]).toEqual({ refusal: fail })
  })

  it('a transient failure is never memoised — the next hover asks again', async () => {
    mockPreview({ fail: 'transient' })
    const card = mountCard()
    await settle()
    expect(card.text()).toBe('No preview available')
    expect(card.find('.animate-pulse').exists()).toBe(false)
    expect(leadPreviews[LEAD]).toBeUndefined()
    mountCard()
    await settle()
    expect(requests).toBe(2)
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
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(leadPreviews[LEAD]).toEqual({ card: CARD })
    warn.mockRestore()
    error.mockRestore()
  })

  it('persists NOTHING to IndexedDB after a successful preview', async () => {
    mockPreview()
    mountCard()
    await settle()
    expect(leadPreviews[LEAD]).toEqual({ card: CARD })
    expect(idbOpen).not.toHaveBeenCalled()
  })
})
