// ONE ANSWER ABOUT THE GRAPH, AND ONE OWNER OF THE GRAPH — through the REAL reactive chain.
//
// Measured 2026-08-12: typing 24 characters into a Create Task Subject fired 25 `graph_outputs` calls,
// because the guard hashed every character of every config and so made each keystroke a distinct question.
// And the canvas built its node list ONCE and never again, so the document refetched after a save was
// refused: two graphs, agreeing only because the save had written what the canvas held.
//
// Both halves are asserted here on the REQUESTS the canvas really posts and on the node OBJECTS it really
// holds — a computed would prove neither.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/tatva/workflows/liveSteps', () => ({ useLiveSteps: () => ({ activeNodes: { value: {} } }) }))

import { mountTatva } from './_mount'
import { mockFrappeMethod, mockGraphContext } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'
import NodeInspector from '@/tatva/workflows/NodeInspector.vue'

// The wire shape `registry.node_types` puts on the declaration: `primitive` and `options` come off
// FIELD_TYPES, `shapes_outputs` is the registry's own marker for the field a type keys its handles on.
const NODE_TYPES = [
  {
    type: 'Trigger',
    label: 'Trigger',
    description: 'Starts the workflow.',
    outputs: ['next'],
    outcomes: [],
    singleton: true,
    config: [
      { name: 'subject_doctype', label: 'Subject', type: 'Select', control: 'select', primitive: true, summary: null, shapes_outputs: false, options: ['CRM Lead', 'CRM Task'] },
    ],
  },
  {
    type: 'Create Task',
    label: 'Create Task',
    description: 'Raises a task.',
    outputs: ['next'],
    outcomes: [],
    config: [
      { name: 'subject_text', label: 'Subject', type: 'Data', control: 'data', primitive: true, summary: { as: 'raw' }, shapes_outputs: false },
    ],
  },
  { type: 'Terminal', label: 'End', description: 'Ends the run.', outputs: [], outcomes: [], config: [] },
]

function definition(subject = 'First Order Punch') {
  return {
    name: 'WF-ONE-ANSWER',
    canvas_json: JSON.stringify({ positions: { 'trigger-1': { x: 0, y: 0 }, 'task-1': { x: 0, y: 200 }, 'end-1': { x: 0, y: 400 } } }),
    nodes: [
      { node_id: 'trigger-1', node_type: 'Trigger', config_json: JSON.stringify({ subject_doctype: 'CRM Lead' }), edges: [{ from_output: 'next', to_node: 'task-1' }] },
      { node_id: 'task-1', node_type: 'Create Task', config_json: JSON.stringify({ subject_text: subject }), edges: [{ from_output: 'next', to_node: 'end-1' }] },
      { node_id: 'end-1', node_type: 'Terminal', config_json: '{}', edges: [] },
    ],
  }
}

const OUTPUTS = { 'trigger-1': ['next'], 'task-1': ['next'], 'end-1': [] }

async function mountCanvas() {
  mockFrappeMethod('tatva_connect.workflow_engine.registry.node_types', NODE_TYPES)
  mockFrappeMethod('tatva_connect.workflow_engine.history.node_counts', {})
  const asked = []
  mockGraphContext({
    outputs: (nodes) => {
      asked.push(nodes)
      return OUTPUTS
    },
    subject: 'CRM Lead', grain: {}, variables: [], emitters: [], settable: [], working_set: [],
    operators_by_type: {}, operator_shapes: {},
  })
  const wrapper = mountTatva(WorkflowCanvas, {
    props: { definition: definition(), editable: true, problems: [] },
  })
  await flushPromises()
  await flushPromises()
  return { wrapper, asked }
}

// The one resolver keeps one 300ms debounce, so a settled edit is WAITED for rather than assumed. The
// margin is generous on purpose: this is real time against a real timer beside every other suite.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 800))
  await flushPromises()
}

async function open(wrapper, nodeId) {
  wrapper.vm.selectedId = nodeId
  await flushPromises()
  const inspector = wrapper.findComponent(NodeInspector)
  expect(inspector.exists(), 'the inspector must be mounted for this to be the real chain').toBe(true)
  return inspector
}

describe('WorkflowCanvas — the server is asked once per MEANING, not once per keystroke', () => {
  it('opens the graph with exactly ONE question, not two', async () => {
    // `graph_outputs` and `authoring_context` took the same argument and fired back to back on every load.
    const { asked } = await mountCanvas()
    await settle()

    expect(asked).toHaveLength(1)
  })

  it('types 24 characters into a Subject and asks NOTHING', async () => {
    // THE measured defect: 24 keystrokes, 25 requests, one unchanged answer.
    const { wrapper, asked } = await mountCanvas()
    await settle()
    const before = asked.length

    const inspector = await open(wrapper, 'task-1')
    const typed = 'First Order Punch EDITED'
    for (let i = 1; i <= typed.length; i++) {
      inspector.vm.setConfig('subject_text', typed.slice(0, i))
      await flushPromises()
    }
    await settle()

    expect(asked.length - before).toBe(0)
    // And the typing really did land — a canvas that ignored the edit would also pass the count.
    expect(JSON.parse(wrapper.vm.nodes.find((n) => n.id === 'task-1').data.node.config_json).subject_text).toBe(typed)
  })

  it("asks exactly once when the Trigger's subject changes, because the whole answer hangs off it", async () => {
    const { wrapper, asked } = await mountCanvas()
    await settle()
    const before = asked.length

    const inspector = await open(wrapper, 'trigger-1')
    inspector.vm.setConfig('subject_doctype', 'CRM Task')
    await settle()

    expect(asked.length - before).toBe(1)
  })

  it('asks exactly once when an edge is drawn', async () => {
    const { wrapper, asked } = await mountCanvas()
    await settle()
    const before = asked.length

    wrapper.vm.edges = [
      ...wrapper.vm.edges,
      { id: 'task-1__next', source: 'task-1', sourceHandle: 'next', target: 'trigger-1' },
    ]
    await settle()

    expect(asked.length - before).toBe(1)
  })
})

describe('WorkflowCanvas — the DOCUMENT owns the graph', () => {
  it('rebuilds from a refetched definition instead of refusing it', async () => {
    // The canvas built once and never again, so the document reloaded after a save was ignored.
    const { wrapper } = await mountCanvas()
    const next = definition()
    next.nodes = [...next.nodes, { node_id: 'task-2', node_type: 'Create Task', config_json: '{}', edges: [] }]

    await wrapper.setProps({ definition: next })
    await flushPromises()
    await flushPromises()

    expect(wrapper.vm.nodes.map((n) => n.id)).toContain('task-2')
  })

  it('keeps the selected node selected across that rebuild, so a save does not close the panel', async () => {
    const { wrapper } = await mountCanvas()
    await open(wrapper, 'task-1')

    await wrapper.setProps({ definition: definition('Saved') })
    await flushPromises()
    await flushPromises()

    expect(wrapper.vm.selectedId).toBe('task-1')
    expect(wrapper.findComponent(NodeInspector).exists()).toBe(true)
    expect(wrapper.vm.nodes.find((n) => n.id === 'task-1').selected).toBe(true)
  })

  it('drops a selection the refetched document no longer has a node for', async () => {
    const { wrapper } = await mountCanvas()
    await open(wrapper, 'task-1')

    const next = definition()
    next.nodes = next.nodes.filter((n) => n.node_id !== 'task-1')
    await wrapper.setProps({ definition: next })
    await flushPromises()
    await flushPromises()

    expect(wrapper.vm.selectedId).toBe(null)
  })

  it('leaves the draft CLEAN after a rebuild from the document it just saved', async () => {
    // The save marks clean and then hands the canvas the saved payload. If the rebuild produced a
    // different content signature, Save would light up again the instant it succeeded.
    const { wrapper } = await mountCanvas()
    wrapper.vm.markClean()
    await flushPromises()

    await wrapper.setProps({ definition: definition() })
    await flushPromises()
    await flushPromises()

    expect(wrapper.vm.dirty).toBe(false)
  })

  it('does NOT rebuild on a local edit — that is what makes Discard work', async () => {
    // The guardrail against over-correcting: the definition changes identity when the DOCUMENT is
    // refetched, never when the author edits. A rebuild here would throw away unsaved work every keystroke.
    const { wrapper } = await mountCanvas()
    const before = wrapper.vm.nodes.find((n) => n.id === 'task-1')

    const inspector = await open(wrapper, 'task-1')
    inspector.vm.setConfig('subject_text', 'Edited locally')
    await settle()

    expect(wrapper.vm.nodes.find((n) => n.id === 'task-1')).toBe(before)
  })
})
