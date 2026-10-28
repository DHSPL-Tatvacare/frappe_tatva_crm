// Purpose: the ⌘K query builder builds a condition through its real rows, counts it through the list's own `get_data`, and opens the list with the filter bar's own filter dict.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { server, http, HttpResponse } from './_msw.js'

const push = vi.fn()
vi.mock('@/router', () => ({
  default: { push, currentRoute: { value: { name: 'Home', params: {}, query: {} } } },
}))

const { run, flatItems, isOpen, levels } = await import('@/tatva/palette/usePalette')
const { conditions } = await import('@/tatva/palette/queryBuilder')

const FIELDS = [{ fieldname: 'custom_stage', label: 'Stage', fieldtype: 'Select', options: 'New\nInterested' }]
const reads = []

const row = (id) => flatItems.value.find((command) => command.id === id)

beforeEach(() => {
  setActivePinia(createPinia())
  reads.length = 0
  server.use(
    // The root list's own named rows, read whenever the root builds; not under test here.
    http.all('*/api/method/tatva_connect.smartview.api.get_smart_views', () => HttpResponse.json({ message: [] })),
    http.all('*/api/method/tatva_connect.search.shortcuts.shortcuts', () => HttpResponse.json({ message: { shortcuts: [] } })),
    http.post('*/api/method/crm.api.doc.get_filterable_fields', () => HttpResponse.json({ message: FIELDS })),
    http.post('*/api/method/crm.api.doc.get_data', async ({ request }) => {
      reads.push(await request.json())
      return HttpResponse.json({ message: { total_count: 3, data: [] } })
    }),
  )
  isOpen.value = true
})

describe('palette query builder', () => {
  it('adds a condition through field → operator → value, counts it on the list door, and opens the list with it', async () => {
    await run(row('query-CRM Lead'))
    await run(row('query-field-custom_stage'))
    await run(row('query-op-equals'))
    await run(row('query-value-Interested'))

    // Back on the builder level, one condition held.
    expect(levels.value.map((level) => level.tag)).toEqual(['query'])
    expect(conditions.value.map((c) => c.label)).toEqual(['Stage equals Interested'])

    await vi.waitFor(() => expect(reads.at(-1)?.filters).toEqual({ custom_stage: 'Interested' }))
    expect(reads.at(-1)).toMatchObject({ doctype: 'CRM Lead', page_length: 1, default_filters: { converted: 0 } })

    await run(row('query-open-list'))
    expect(push).toHaveBeenCalledWith({
      name: 'Leads',
      params: { viewType: 'list' },
      query: { filters: JSON.stringify({ custom_stage: 'Interested' }) },
    })
  })
})
