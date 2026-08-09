// The run history of one workflow is a LIST, and it used to be a modal that hardcoded its own six columns, their widths, its own search box and its own status dropdown — so a reader could not add a column, could not sort, and lost a dragged width the moment it closed. It is now a page over `CRM Workflow Journey` assembled exactly as `Leads.vue` is: `ViewBreadcrumbs` + `ViewControls` + a list view with the same props and emits, and everything it was missing arrives from `CRM View Settings` through that toolbar. These assertions pin that the page DECIDES nothing about columns, and that the two cells a raw string would lie about still read correctly.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

// `stores/settings` creates its FCRM Settings document resource at MODULE scope, and importing `ViewControls` is enough to run it — so stubbing the component cannot stop the fetch, and an unmocked one is an unhandled rejection that escapes this file into unrelated suites.
vi.mock('@/stores/settings', () => ({
  getSettings: () => ({ settings: { value: {} }, brand: {}, setupBrand: () => {} }),
}))
import { ListView, ListFooter, Badge } from 'frappe-ui'

import { mountTatva, RouterLinkStub } from './_mount'
import { mockFrappeMethod } from './_msw'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import WorkflowRuns from '@/tatva/workflows/WorkflowRuns.vue'
import WorkflowRunsListView from '@/tatva/workflows/WorkflowRunsListView.vue'

const GET_WORKFLOW = 'tatva_connect.workflows.api.get_workflow'

// The real toolbar owns four resources and a Pinia store, and none of them is what this page contracts for; what IS the contract is which doctype it hands over and what it pins the list to, so the stub records the props and plays the toolbar's own part — it ASSIGNS the list resource back through v-model.
const ViewControlsStub = {
  name: 'ViewControls',
  props: ['modelValue', 'doctype', 'filters', 'options'],
  emits: ['update:modelValue'],
  template: '<div data-stub="ViewControls" />',
}

// The native bulk-actions host reads `globalStore()`, so it needs a live Pinia; it is the CRM's own component and is not what this list contracts for — the same reason the shared mount stubs the editor and the avatar.
const stubs = {
  ViewControls: ViewControlsStub,
  ListBulkActions: {
    name: 'ListBulkActionsStub',
    template: '<div data-stub="ListBulkActions" />',
  },
}

// What `crm.api.doc.get_data` answers for this doctype: the columns are the SERVER's — the reader's saved view, or `default_list_data` before they have one — and never this page's.
function listData(overrides = {}) {
  return {
    data: {
      data: [
        {
          name: 'JRN-0003',
          subject_doctype: 'CRM Lead',
          subject_name: 'crm-lead-0001',
          status: 'Failed',
          current_node: 'send-1',
          creation: '2026-08-01 09:00:00',
          modified: '2026-08-01 09:01:00',
        },
        {
          name: 'JRN-0002',
          subject_doctype: 'CRM Lead',
          subject_name: 'crm-lead-0002',
          status: 'Done',
          current_node: 'end-1',
          creation: '2026-07-31 08:00:00',
          modified: '2026-07-31 08:05:00',
        },
      ],
      columns: [
        { label: 'Run ID', type: 'Data', key: 'name', width: '10rem' },
        {
          label: 'Lead',
          type: 'Dynamic Link',
          key: 'subject_name',
          options: 'subject_doctype',
          width: '14rem',
        },
        { label: 'Status', type: 'Select', key: 'status', width: '8rem' },
        { label: 'Started', type: 'Datetime', key: 'creation', width: '10rem' },
      ],
      rows: [
        'name',
        'subject_doctype',
        'subject_name',
        'status',
        'current_node',
        'creation',
        'modified',
      ],
      _link_titles: {
        'CRM Lead::crm-lead-0001': 'Asha',
        'CRM Lead::crm-lead-0002': 'Bharat',
      },
      row_count: 2,
      total_count: 2,
      page_length_count: 20,
      view_type: 'list',
      ...overrides,
    },
    params: {},
  }
}

async function mountPage(data) {
  mockFrappeMethod(GET_WORKFLOW, {
    name: 'WF-1',
    workflow_name: 'TP Courtesy Visit',
  })
  const wrapper = mountTatva(WorkflowRuns, {
    props: { workflowId: 'WF-1' },
    global: { stubs },
  })
  await flushPromises()
  if (data !== undefined) {
    await wrapper
      .findComponent(ViewControlsStub)
      .vm.$emit('update:modelValue', data)
    await flushPromises()
  }
  return wrapper
}

describe('WorkflowRuns page', () => {
  it('is the CRM list toolbar over the journey doctype, pinned to this workflow', async () => {
    const wrapper = await mountPage()
    const controls = wrapper.findComponent(ViewControlsStub)
    expect(controls.props('doctype')).toBe('CRM Workflow Journey')
    expect(controls.props('filters')).toEqual({ workflow: 'WF-1' })
  })

  it('names the workflow in the breadcrumb and offers the way back to its canvas', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('TP Courtesy Visit')
    const targets = wrapper
      .findAllComponents(RouterLinkStub)
      .map((l) => l.props('to'))
    expect(targets).toContainEqual({
      name: 'Workflow',
      params: { workflowId: 'WF-1' },
    })
  })

  it('renders whatever columns the server sent, and decides none of them itself', async () => {
    const wrapper = await mountPage(listData())
    const list = wrapper.findComponent(WorkflowRunsListView)
    expect(list.props('columns').map((c) => c.key)).toEqual([
      'name',
      'subject_name',
      'status',
      'creation',
    ])
  })

  it('says so plainly when a workflow has never run', async () => {
    const wrapper = await mountPage(
      listData({ data: [], row_count: 0, total_count: 0 }),
    )
    expect(wrapper.findComponent(EmptyState).exists()).toBe(true)
    expect(wrapper.findComponent(WorkflowRunsListView).exists()).toBe(false)
  })
})

describe('WorkflowRunsListView', () => {
  const mountList = (data = listData()) =>
    mountTatva(WorkflowRunsListView, {
      props: {
        rows: data.data.data,
        columns: data.data.columns,
        list: data,
        modelValue: 20,
        options: {
          selectable: true,
          showTooltip: false,
          resizeColumn: true,
          rowCount: 2,
          totalCount: 2,
        },
      },
      global: { stubs },
    })

  it('is the native list surface, footer and all', () => {
    const wrapper = mountList()
    expect(wrapper.findComponent(ListView).exists()).toBe(true)
    expect(wrapper.findComponent(ListFooter).exists()).toBe(true)
  })

  it('paints a failed run red and a finished one green — the engine words, in the canvas colours', () => {
    const themes = mountList()
      .findAllComponents(Badge)
      .map((b) => b.props('theme'))
    expect(themes).toContain('red')
    expect(themes).toContain('green')
  })

  it('reads the lead by name while the row keeps the docname it filters by', () => {
    const wrapper = mountList()
    expect(wrapper.text()).toContain('Asha')
    expect(wrapper.text()).toContain('Bharat')
    expect(wrapper.text()).not.toContain('crm-lead-0001')
  })
})
