// Pruning runs through the reactive chain, so it is tested through the reactive chain: three defects hid behind unit tests that called pruneInvalidEdges with a hand-built map, which proves the helper and nothing about the wiring that calls it.
// The graph_context mock answers as a FUNCTION OF THE GRAPH IT IS POSTED, because a mock returning a constant cannot see a stale input.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

// Same shape SmartViewEditor.test.js uses: the delete confirmation is not the contract under test.
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
// Live-run highlighting reaches the socket through the pinia global store; neither is this contract.
vi.mock('@/tatva/workflows/liveSteps', () => ({ useLiveSteps: () => ({ activeNodes: { value: {} } }) }))

import { mountTatva } from './_mount'
import { mockFrappeMethod, mockGraphContext } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'
import NodeInspector from '@/tatva/workflows/NodeInspector.vue'

const UNTIL_EVENT = 'Until Event'
const UNTIL_TIME = 'Until Time'
const FOR_DURATION = 'For Duration'
const EVENT_OR_TIMEOUT = 'Event-or-Timeout'

// What the backend answers for this probe graph, keyed on the mode the request CARRIES — never a copy of the resolution rule.
const ANSWER_FOR_MODE = {
  [UNTIL_EVENT]: ['yes', 'no'],
  [EVENT_OR_TIMEOUT]: ['yes', 'no', 'timeout'],
  [FOR_DURATION]: ['next'],
  [UNTIL_TIME]: ['next'],
}

const NODE_TYPES = [
  {
    type: 'Send WhatsApp',
    label: 'Send WhatsApp',
    description: 'Sends a template message.',
    outputs: ['sent', 'failed'],
    outcomes: [],
    config: [{ name: 'buttons', label: 'Buttons', type: 'Button List', control: 'button-list', primitive: false, summary: { count: 'buttons' }, shapes_outputs: false }],
  },
  {
    type: 'Wait',
    label: 'Wait',
    description: 'Suspends the run.',
    outputs: null,
    outcomes: [],
    config: [
      { name: 'mode', label: 'Mode', type: 'Select', control: 'select', primitive: true, summary: null, shapes_outputs: true, options: [UNTIL_EVENT, FOR_DURATION, UNTIL_TIME, EVENT_OR_TIMEOUT] },
      { name: 'source_node', label: 'Waiting on', type: 'Node', control: 'graph-select', primitive: false, summary: null, shapes_outputs: false, depends_on_value: { mode: [UNTIL_EVENT, EVENT_OR_TIMEOUT] } },
    ],
  },
  { type: 'Terminal', label: 'End', description: 'Ends the run.', outputs: [], outcomes: [], config: [] },
]

function definition(mode) {
  return {
    name: 'WF-PRUNE',
    canvas_json: null,
    nodes: [
      {
        node_id: 'send-1',
        node_type: 'Send WhatsApp',
        config_json: JSON.stringify({ buttons: [{ id: 'yes' }, { id: 'no' }] }),
        edges: [{ from_output: 'sent', to_node: 'wait-1' }],
      },
      {
        node_id: 'wait-1',
        node_type: 'Wait',
        config_json: JSON.stringify({ mode, source_node: 'send-1' }),
        edges: [
          { from_output: 'yes', to_node: 'end-1' },
          { from_output: 'no', to_node: 'end-1' },
        ],
      },
      { node_id: 'end-1', node_type: 'Terminal', config_json: '{}', edges: [] },
    ],
  }
}

// Every graph the canvas asked about, in order, so a stale INPUT is visible as data.
let asked = []

function outputsFor(nodes) {
  asked.push(nodes)
  const answer = {}
  for (const node of nodes) {
    const config = JSON.parse(node.config_json || '{}')
    if (node.node_type === 'Wait') answer[node.node_id] = ANSWER_FOR_MODE[config.mode] || []
    else if (node.node_type === 'Send WhatsApp') answer[node.node_id] = ['sent', 'failed']
    else answer[node.node_id] = []
  }
  return answer
}

async function mountCanvas(mode) {
  mockFrappeMethod('tatva_connect.workflow_engine.registry.node_types', NODE_TYPES)
  mockFrappeMethod('tatva_connect.workflow_engine.history.node_counts', {})
  asked = []
  mockGraphContext({
    outputs: outputsFor,
    subject: 'CRM Lead', grain: {}, variables: [], emitters: [], settable: [],
    operators_by_type: {}, operator_shapes: {},
  })

  const wrapper = mountTatva(WorkflowCanvas, {
    props: { definition: definition(mode), editable: true, problems: [] },
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

// Change the Wait's mode the way the inspector really does: `update:config` then `shape-change`, in that order.
async function changeMode(wrapper, to) {
  wrapper.vm.selectedId = 'wait-1'
  await flushPromises()

  const inspector = wrapper.findComponent(NodeInspector)
  expect(inspector.exists(), 'the inspector must be mounted for this to be the real chain').toBe(true)

  inspector.vm.setConfig('mode', to)
  await flushPromises()
  await flushPromises()
  return wrapper
}

function survivingHandles(wrapper) {
  return wrapper.vm.edges.filter((e) => e.source === 'wait-1').map((e) => e.sourceHandle).sort()
}

describe('WorkflowCanvas — a mode change prunes against the graph the author just produced', () => {
  beforeEach(() => {
    asked = []
  })

  it('asks the backend about the NEW mode, never the one the author left', async () => {
    // The defect as DATA: a graph asked about a tick late still carries the old mode.
    const wrapper = await mountCanvas(UNTIL_EVENT)
    await changeMode(wrapper, UNTIL_TIME)

    const last = asked[asked.length - 1]
    const wait = last.find((n) => n.node_id === 'wait-1')
    expect(JSON.parse(wait.config_json).mode).toBe(UNTIL_TIME)
  })

  it('prunes the button branches when the Wait becomes a pure timer', async () => {
    const wrapper = await mountCanvas(UNTIL_EVENT)
    await changeMode(wrapper, FOR_DURATION)

    expect(survivingHandles(wrapper)).toEqual([])
  })

  it('prunes them for the OTHER timer mode too — the row that behaved differently', async () => {
    // Same starting mode and same expected answer as the case above, yet it kept the edges in the browser.
    const wrapper = await mountCanvas(UNTIL_EVENT)
    await changeMode(wrapper, UNTIL_TIME)

    expect(survivingHandles(wrapper)).toEqual([])
  })

  it('KEEPS valid wiring when the button branches come back', async () => {
    // The damaging row: branches deleted at the moment the handles that need them reappeared, silently.
    const wrapper = await mountCanvas(UNTIL_TIME)
    wrapper.vm.edges = [
      { id: 'wait-1__yes', source: 'wait-1', sourceHandle: 'yes', target: 'end-1' },
      { id: 'wait-1__no', source: 'wait-1', sourceHandle: 'no', target: 'end-1' },
    ]
    await changeMode(wrapper, EVENT_OR_TIMEOUT)

    expect(survivingHandles(wrapper)).toEqual(['no', 'yes'])
  })

  it('a field that does not reshape outputs never triggers a prune at all', async () => {
    // `shapes_outputs` is the declaration's answer to WHEN handles change; pruning on every keystroke would be a second rule.
    const wrapper = await mountCanvas(UNTIL_EVENT)
    wrapper.vm.selectedId = 'wait-1'
    await flushPromises()

    const before = wrapper.vm.edges.length
    wrapper.findComponent(NodeInspector).vm.setConfig('source_node', 'send-1')
    await flushPromises()

    expect(wrapper.vm.edges.length).toBe(before)
  })
})
