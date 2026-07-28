// The grouped value picker, through the REAL chain (WorkflowCanvas → node_context → NodeInspector →
// Autocomplete). `valueOptions.test.js` proves the grouper; this proves it is WIRED — that the inspector
// asks the backend for a node's position, renders the answer grouped, and points the spotlight at the
// node that produced the value. A unit test on the helper would have stayed green through every one of
// those three going wrong.
//
// The `control` names below are the backend's own (`registry.FIELD_TYPES`): `Variable` → `value-picker`,
// `Field` → `field-picker`. Inventing a control name here would mean testing a branch that never runs.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { Autocomplete } from 'frappe-ui'

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/tatva/workflows/liveRun', () => ({ useLiveRun: () => ({ activeNodes: { value: {} } }) }))

import { mountTatva } from './_mount'
import { mockFrappeMethod } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'
import NodeInspector from '@/tatva/workflows/NodeInspector.vue'
import WorkflowNode from '@/tatva/workflows/WorkflowNode.vue'

const NODE_TYPES = [
  {
    type: 'Call API',
    label: 'Call API',
    description: 'Calls a curated endpoint.',
    outputs: ['succeeded', 'failed'],
    outcomes: [],
    config: [],
  },
  {
    type: 'Send WhatsApp',
    label: 'Send WhatsApp',
    description: 'Sends a template message.',
    outputs: ['sent', 'failed'],
    outcomes: [],
    config: [
      { name: 'contact_number', label: 'Contact number', type: 'Variable', control: 'value-picker',
        primitive: false, summary: null, shapes_outputs: false, reqd: true },
    ],
  },
  { type: 'Terminal', label: 'End', description: 'Ends the run.', outputs: [], outcomes: [], config: [] },
]

// The send reads a value the Call API above it produced — the whole reason the picker groups by source.
const DEFINITION = {
  name: 'WF-PICKER',
  canvas_json: null,
  nodes: [
    { node_id: 'call-api-1', node_type: 'Call API', config_json: '{}',
      edges: [{ from_output: 'succeeded', to_node: 'send-1' }] },
    { node_id: 'send-1', node_type: 'Send WhatsApp',
      config_json: JSON.stringify({ contact_number: 'call-api-1.phone' }),
      edges: [{ from_output: 'sent', to_node: 'end-1' }] },
    { node_id: 'end-1', node_type: 'Terminal', config_json: '{}', edges: [] },
  ],
}

// `upstream.available_at`'s real answer at send-1: what the ancestor emitted, then the subject's fields.
const VARIABLES = [
  { ref: 'call-api-1.phone', label: 'phone', type: 'Data', source: 'call-api-1', source_label: 'call-api-1 · Call API' },
  { ref: 'call-api-1.status', label: 'HTTP status code', type: 'Int', source: 'call-api-1', source_label: 'call-api-1 · Call API' },
  { ref: 'crm_lead.mobile_no', label: 'Mobile No', type: 'Data', source: 'crm_lead', source_label: 'CRM Lead' },
]

async function mountCanvas(variables = VARIABLES, config = null) {
  const definition = config
    ? { ...DEFINITION, nodes: DEFINITION.nodes.map((n) => (n.node_id === 'send-1' ? { ...n, config_json: config } : n)) }
    : DEFINITION

  mockFrappeMethod('tatva_connect.workflow_engine.registry.node_types', NODE_TYPES)
  mockFrappeMethod('tatva_connect.workflow_engine.history.node_counts', {})
  mockFrappeMethod('tatva_connect.workflow_engine.context.node_context', {
    subject: 'CRM Lead', grain: {}, variables, emitters: [], settable: [],
    operators_by_type: {}, operator_shapes: {},
  })
  mockFrappeMethod('tatva_connect.workflow_engine.registry.graph_outputs', {
    'call-api-1': ['succeeded', 'failed'], 'send-1': ['sent', 'failed'], 'end-1': [],
  })

  const wrapper = mountTatva(WorkflowCanvas, {
    props: { definition, editable: true, problems: [] },
  })
  await flushPromises()
  wrapper.vm.selectedId = 'send-1'
  await flushPromises()

  // `NodeInspector` debounces its `node_context` reload by 300ms — a keystroke rewrites a node the
  // `graph` prop holds, so the watcher fires far more often than the question changes. `flushPromises`
  // settles microtasks and does NOT advance a timer, so without this the picker is asserted while its
  // options are still empty and every expectation here would be measuring the debounce, not the wiring.
  await new Promise((resolve) => setTimeout(resolve, 350))
  await flushPromises()
  return wrapper
}

describe('the value picker offers what is upstream, grouped by what produced it', () => {
  let wrapper
  let inspector

  beforeEach(async () => {
    wrapper = await mountCanvas()
    inspector = wrapper.findComponent(NodeInspector)
    expect(inspector.exists(), 'the inspector must mount for this to be the real chain').toBe(true)
  })

  it('renders one group per source, in the order the backend answered', () => {
    const groups = inspector.findComponent(Autocomplete).props('options')

    expect(groups.map((g) => g.group)).toEqual(['call-api-1 · Call API', 'CRM Lead'])
    expect(groups[0].items.map((i) => i.value)).toEqual(['call-api-1.phone', 'call-api-1.status'])
  })

  it('spotlights the node that produced the held value while the pointer is on the control', async () => {
    const producer = () =>
      wrapper.findAllComponents(WorkflowNode).find((n) => n.props('id') === 'call-api-1')

    expect(producer().props('spotlit')).toBe(false)

    await inspector.find('[data-test="value-picker"]').trigger('mouseenter')
    expect(producer().props('spotlit')).toBe(true)

    await inspector.find('[data-test="value-picker"]').trigger('mouseleave')
    expect(producer().props('spotlit')).toBe(false)
  })
})

describe('the picker never silently drops what a node already references', () => {
  it('keeps a saved ref that nothing upstream produces any more, and says so', async () => {
    // The author wired this to a node that has since been deleted. Narrowing the offer must not blank it.
    const wrapper = await mountCanvas(VARIABLES, JSON.stringify({ contact_number: 'deleted-2.phone' }))
    const groups = wrapper.findComponent(NodeInspector).findComponent(Autocomplete).props('options')

    expect(groups[0].items[0].value).toBe('deleted-2.phone')
    expect(groups.slice(1).map((g) => g.group)).toEqual(['call-api-1 · Call API', 'CRM Lead'])
  })

  it('spotlights nothing when the value came from the SUBJECT rather than a node', async () => {
    const wrapper = await mountCanvas(VARIABLES, JSON.stringify({ contact_number: 'crm_lead.mobile_no' }))
    const inspector = wrapper.findComponent(NodeInspector)

    await inspector.find('[data-test="value-picker"]').trigger('mouseenter')
    // `crm_lead` is a doctype slug, not a node id — nothing on the canvas may light up for it.
    expect(wrapper.findAllComponents(WorkflowNode).some((n) => n.props('spotlit'))).toBe(false)
  })
})
