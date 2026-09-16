// SmartViewList renders get_data as a native ListView; the network is mocked via MSW so the real createResource path runs.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { delay } from 'msw'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ListView, ListFooter } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod, server, http, HttpResponse } from './_msw.js'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import { formatListDate } from '@/utils'

// A bare mount installs no Pinia; the list only reads getView and writes setCount.
vi.mock('@/stores/smartViews', () => ({
  smartViewsStore: () => ({ getView: () => ({}), setCount: vi.fn() }),
}))

// `$socket` is null, as in a bare mount with no socket plugin; every reader guards on it.
vi.mock('@/stores/global', () => ({
  globalStore: () => ({ $socket: null }),
}))

// The assignee column resolves an email to a name and avatar through the users store, another bare-mount Pinia store.
vi.mock('@/stores/users', () => ({
  usersStore: () => ({ getUser: (email) => ({ name: email, full_name: email, user_image: '' }) }),
}))

// `useExportJob` is a Pinia store; the list only reads `preparing` and calls `track`.
vi.mock('@/tatva/useExportJob', () => ({
  useExportJob: () => ({
    preparing: false,
    rowsSoFar: 0,
    track: vi.fn(),
    resume: vi.fn(),
  }),
}))

import SmartViewList from '@/tatva/SmartViewList.vue'

const GET_DATA = 'tatva_connect.smartview.api.get_data'
const CATALOG = 'tatva_connect.smartview.api.field_catalog'
// Whether to offer the export item; mocked so it never reaches the network.
const CAN_EXPORT = 'tatva_connect.smartview.api.can_export'
// The toolbar's saved filter presets load on mount; `list_presets` answers a list of the user's rows.
const PRESETS = 'tatva_connect.presets.list_presets'
// The list reopens on the person's remembered filters on mount; `null` is "nothing remembered".
const PRESETS_CURRENT = 'tatva_connect.presets.current'
// The list formats numbers through the doctype's meta, which `getMeta` fetches on mount; `docs` returns the body whole.
const GET_DOCTYPE = '*/api/method/frappe.desk.form.load.getdoctype'

// A Lead view: a Data title col, a Select status col, a Date col (proves formatting + last-col align).
const columns = [
  { key: 'lead_name', label: 'Lead Name', fieldtype: 'Data' },
  { key: 'status', label: 'Status', fieldtype: 'Select' },
  { key: 'created', label: 'Created On', fieldtype: 'Date' },
]
const rows = [
  { name: 'LEAD-1', lead_name: 'Asha', status: 'Open', created: '2026-01-15' },
  {
    name: 'LEAD-2',
    lead_name: 'Bharat',
    status: 'Closed',
    created: '2026-02-20',
  },
]

// A unique viewName per test keeps the resource cache fresh, so no prior test's data serves this mount.
let seq = 0
const freshView = () => `sv-test-${++seq}`

// A Lead view's identity cell (LeadCell) resolves an href through useRouter(), so every mount needs a router.
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/leads/:leadId',
      name: 'Lead',
      component: { template: '<div />' },
    },
    {
      path: '/deals/:dealId',
      name: 'Deal',
      component: { template: '<div />' },
    },
  ],
})

// Every request besides get_data, answered so nothing reaches the network; an empty catalog keeps Filter/SortBy hidden.
function mockBoundary() {
  mockFrappeMethod(CATALOG, [])
  mockFrappeMethod(CAN_EXPORT, false)
  mockFrappeMethod(PRESETS, [])
  mockFrappeMethod(PRESETS_CURRENT, null)
  const meta = () => HttpResponse.json({ docs: [], user_settings: '{}' })
  server.use(http.get(GET_DOCTYPE, meta), http.post(GET_DOCTYPE, meta))
}

// The list reads `route.query` on mount for a dashboard drill, so every mount carries the router.
function mountList(props = {}) {
  return mountTatva(SmartViewList, {
    props: { viewName: freshView(), baseObject: 'Lead', ...props },
    global: { plugins: [router] },
  })
}

// Answers get_data with `payload` and records every request's params; `hold()` keeps later requests in flight until `release()`.
function recordGetData(payload) {
  const asked = []
  let gate = null
  let open = () => {}
  const respond = async ({ request }) => {
    const url = new URL(request.url)
    const body = request.method === 'POST' ? await request.clone().json() : Object.fromEntries(url.searchParams)
    asked.push(body)
    if (gate) await gate
    return HttpResponse.json({ message: payload })
  }
  server.use(http.get(`*/api/method/${GET_DATA}`, respond), http.post(`*/api/method/${GET_DATA}`, respond))
  const hold = () => (gate = new Promise((r) => (open = r)))
  const release = () => {
    gate = null
    open()
  }
  return { asked, hold, release }
}

const settle = async (ms) => {
  await new Promise((r) => setTimeout(r, ms))
  await flushPromises()
}

async function mountLoaded(payload, props = {}) {
  mockBoundary()
  mockFrappeMethod(GET_DATA, payload)
  const wrapper = mountList(props)
  await flushPromises()
  return wrapper
}

describe('SmartViewList', () => {
  it('shows the Loading… branch while get_data is in flight (before it resolves)', async () => {
    mockBoundary()
    // Hold get_data open so the resource stays mid-flight (loading && no rows yet).
    server.use(
      http.get(`*/api/method/${GET_DATA}`, async () => {
        await delay('infinite')
      }),
      http.post(`*/api/method/${GET_DATA}`, async () => {
        await delay('infinite')
      }),
    )
    const wrapper = mountList()
    // onMounted(reload) sets list.loading after the first render; flush microtasks to re-render.
    await flushPromises()
    expect(wrapper.text()).toContain('Loading…')
    expect(wrapper.findComponent(ListView).exists()).toBe(false)
  })

  it('feeds ListView the configured columns IN ORDER, aligned by fieldtype', async () => {
    const wrapper = await mountLoaded({ columns, rows, total: 2 })
    const cols = wrapper.findComponent(ListView).props('columns')
    expect(cols.map((c) => c.key)).toEqual(['lead_name', 'status', 'created'])
    expect(cols.map((c) => c.label)).toEqual([
      'Lead Name',
      'Status',
      'Created On',
    ])
    // Text reads left and a measurement right, the rule the native column picker applies (listColumns.alignFor).
    expect(cols.map((c) => c.align)).toEqual(['left', 'left', 'left'])
  })

  it('hands ListView the raw rows and formats each cell in the slot: a Date never shows raw ISO', async () => {
    const wrapper = await mountLoaded({ columns, rows, total: 2 })
    const display = wrapper.findComponent(ListView).props('rows')
    expect(display).toHaveLength(2)
    // The rows keep their keys and raw values, so navigation, sort and filter still see the real value.
    expect(display[0]).toMatchObject({ name: 'LEAD-1', lead_name: 'Asha', status: 'Open', created: '2026-01-15' })
    const text = wrapper.text()
    expect(text).toContain('Asha')
    expect(text).toContain(formatListDate('2026-01-15'))
    expect(text).toContain(formatListDate('2026-02-20'))
    expect(text).not.toContain('2026-01-15')
  })

  it('renders the native EmptyState (and no ListView) when the view returns no rows', async () => {
    const wrapper = await mountLoaded({ columns, rows: [], total: 0 })
    expect(wrapper.findComponent(ListView).exists()).toBe(false)
    expect(wrapper.findComponent(EmptyState).exists()).toBe(true)
    expect(wrapper.text()).toContain('No records')
  })

  it('emits openLead(name) when a Lead-view row is clicked', async () => {
    const wrapper = await mountLoaded(
      { columns, rows, total: 2 },
      { baseObject: 'Lead' },
    )
    // The row-click contract is delegated up via the ListView onRowClick option (= openRow).
    wrapper.findComponent(ListView).props('options').onRowClick(rows[0])
    expect(wrapper.emitted('openLead')[0]).toEqual(['LEAD-1'])
    expect(wrapper.emitted('openTask')).toBeUndefined()
  })

  it('an Activity view drives CRM Task and emits openTask(name) on row click', async () => {
    const wrapper = await mountLoaded(
      { columns, rows, total: 2 },
      { baseObject: 'Activity' },
    )
    wrapper.findComponent(ListView).props('options').onRowClick(rows[1])
    expect(wrapper.emitted('openTask')[0]).toEqual(['LEAD-2'])
    expect(wrapper.emitted('openLead')).toBeUndefined()
  })

  it('reports the view total to the footer for load-more', async () => {
    const wrapper = await mountLoaded({ columns, rows, total: 137 })
    const footer = wrapper.findComponent(ListFooter)
    expect(footer.exists()).toBe(true)
    expect(footer.props('options').totalCount).toBe(137)
    expect(footer.props('options').rowCount).toBe(2)
  })

  it('Load More widens the one window like the native page_length, and asks for no page', async () => {
    mockBoundary()
    const { asked } = recordGetData({ columns, rows, total: 137 })
    const wrapper = mountList()
    await flushPromises()
    wrapper.findComponent(ListFooter).vm.$emit('loadMore')
    await flushPromises()
    expect(asked.map((p) => Number(p.page_size))).toEqual([50, 100])
    expect(asked.every((p) => p.page === undefined)).toBe(true)
  })

  it('a Load More clicked mid-load is refused before the window moves, so no rows are skipped', async () => {
    mockBoundary()
    const { asked, hold } = recordGetData({ columns, rows, total: 137 })
    const wrapper = mountList()
    await flushPromises()
    hold()
    const footer = wrapper.findComponent(ListFooter)
    footer.vm.$emit('loadMore')
    await flushPromises()
    footer.vm.$emit('loadMore')
    await flushPromises()
    expect(asked.map((p) => Number(p.page_size))).toEqual([50, 100])
  })

  it('a search typed mid-load is asked once the load lands, never dropped', async () => {
    mockBoundary()
    const { asked, hold, release } = recordGetData({ columns, rows, total: 137 })
    const wrapper = mountList()
    await flushPromises()
    hold()
    wrapper.findComponent(ListFooter).vm.$emit('loadMore')
    await flushPromises()
    await wrapper.find('input[type="text"]').setValue('asha')
    await settle(350)
    expect(asked.length).toBe(2)
    release()
    await settle(50)
    expect(asked.length).toBe(3)
    expect(asked[2].search).toBe('asha')
  })

  it('changes made while a load runs collapse into ONE follow-up on the latest state', async () => {
    mockBoundary()
    const { asked, hold, release } = recordGetData({ columns, rows, total: 137 })
    const wrapper = mountList()
    await flushPromises()
    hold()
    wrapper.findComponent(ListFooter).vm.$emit('loadMore')
    await flushPromises()
    const input = wrapper.find('input[type="text"]')
    await input.setValue('no')
    await settle(350)
    await input.setValue('')
    await settle(350)
    release()
    await settle(50)
    expect(asked.length).toBe(3)
    expect(asked[2].search).toBeUndefined()
  })

  it('a saved view refetches its rows and fields once, in the same instance', async () => {
    mockBoundary()
    const { asked } = recordGetData({ columns, rows, total: 137 })
    const wrapper = mountList()
    await flushPromises()
    await wrapper.setProps({ revision: 1 })
    await flushPromises()
    expect(asked.length).toBe(2)
  })

  it('shows the access-denied branch (not rows) when get_data errors', async () => {
    mockBoundary()
    // A Frappe-shaped 403 body so frappeRequest's error transform parses it (sets list.error).
    const errBody = {
      exc_type: 'PermissionError',
      exc: '["PermissionError"]',
      _server_messages: '[]',
    }
    server.use(
      http.get(`*/api/method/${GET_DATA}`, () =>
        HttpResponse.json(errBody, { status: 403 }),
      ),
      http.post(`*/api/method/${GET_DATA}`, () =>
        HttpResponse.json(errBody, { status: 403 }),
      ),
    )
    const wrapper = mountList()
    await flushPromises()
    expect(wrapper.findComponent(ListView).exists()).toBe(false)
    expect(wrapper.text()).toContain('You do not have access to this view.')
  })
})
