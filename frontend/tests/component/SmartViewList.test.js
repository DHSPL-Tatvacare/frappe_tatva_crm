// Purpose: SmartViewList is the read-only result body of a saved Smart View. From ONE server method
// (tatva_connect.smartview.api.get_data → { columns, rows, total }) it builds a native ListView: the
// configured columns IN ORDER (aligned by fieldtype), each row's cells formatted to display
// strings in the cell slot (Date via formatListDate, never raw ISO), the native EmptyState when the predicate returns no
// rows, a "Loading…" branch while the resource is in flight, and an access-denied branch on error. A
// row click is delegated up — a Lead view emits openLead(name), an Activity view emits openTask(name).
// We mock get_data + the field_catalog at the network boundary (frappe-ui's MSW convention) so the real
// createResource path runs, and mock the smartViews Pinia store (no active pinia in a bare mount).
import { describe, it, expect, vi, onTestFinished } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { delay } from 'msw'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ListView, ListFooter } from 'frappe-ui'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod, server, http, HttpResponse } from './_msw.js'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import { formatListDate } from '@/utils'

// The store is a Pinia setup-store; a bare mountTatva installs no pinia, so smartViewsStore() would
// throw. The list only reads getView (view meta for the catalog) and writes setCount on each load.
vi.mock('@/stores/smartViews', () => ({
  smartViewsStore: () => ({ getView: () => ({}), setCount: vi.fn() }),
}))

// `$socket` is null because a bare mount installs no socket plugin, which is the real shape of
// `globalProperties.$socket` here; every reader already guards on it.
vi.mock('@/stores/global', () => ({
  globalStore: () => ({ $socket: null }),
}))

// The assignee column resolves an email to a name and avatar through the users store, another bare-mount Pinia store.
vi.mock('@/stores/users', () => ({
  usersStore: () => ({ getUser: (email) => ({ name: email, full_name: email, user_image: '' }) }),
}))

// `useExportJob` is a Pinia store now, not a composable — an export outlives the screen that asked for
// it, so a route change must not take its socket listeners and poll down with the component. That makes
// it the same bare-mount problem as the two stores above. This list only reads `preparing` for the
// dialog's button and calls `track` with what the endpoint queued; the lifecycle itself is asserted
// server-side in tests/smartview/test_export_is_drained_by_a_worker.
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
// The component asks whether to OFFER the export item. Left unmocked it reached the network and produced
// unhandled rejections that escaped this file and destabilised unrelated suites in CI.
const CAN_EXPORT = 'tatva_connect.smartview.api.can_export'
// The toolbar's saved filter presets load on mount; `list_presets` answers a list of the user's rows.
const PRESETS = 'tatva_connect.presets.list_presets'
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

// Each test uses a unique viewName so the resource cache key (['smart-view', viewName]) is fresh and a
// prior test's data never serves this mount synchronously (which would skip the loading branch).
let seq = 0
const freshView = () => `sv-test-${++seq}`

// Mount with get_data resolved; field_catalog returns [] so the (heavy) Filter/SortBy/ColumnSettings
// toolbar stays hidden (catalogReady=false) — not this component's contract.
// A Lead view's identity cell is LeadCell, which resolves an href through useRouter(); with no router it is undefined and the cell throws mid-render, which reads as "the footer is missing" rather than "there is no router".
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

// Every request the list makes besides get_data, answered so nothing reaches the network.
function mockBoundary() {
  mockFrappeMethod(CATALOG, [])
  mockFrappeMethod(CAN_EXPORT, false)
  mockFrappeMethod(PRESETS, [])
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

  it('shows the access-denied branch (not rows) when get_data errors', async () => {
    // The component's reload() fire-and-forgets list.reload(), and frappe-ui's handleError ALWAYS
    // re-throws — so an errored load surfaces as a structurally-unhandled rejection. Own it here.
    const swallow = () => {}
    process.on('unhandledRejection', swallow)
    onTestFinished(() => process.off('unhandledRejection', swallow))
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
