// The canvas must ask the backend about the graph ON SCREEN, not the one it was loaded with.
//
// Every authoring answer that depends on POSITION — which nodes a Wait may wait on, which outcomes it may
// name, which values any picker may offer — is computed by walking `edges` in the payload the browser
// posts. A node's `edges` are the wiring it was LOADED with and nothing ever writes them again: `onConnect`
// appends to the canvas's own edge list, and the two are merged only when the author presses Save. So an
// edge drawn on screen was invisible to the backend, and a Wait wired to the node above it offered nothing
// in either picker — no event-driven journey could be authored at all.
//
// Saving did not repair it either, which is why "save and reopen" was a misleading check: `save()` reloads
// the document but never bumps the canvas key, and the build watcher returns early once nodes exist.
//
// Asserted on the REQUEST BODY, the way WorkflowCanvasPrune asserts on the graph it posts: a mock that
// answered a constant could not see a stale input, and neither could a test that only read a computed.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/tatva/workflows/liveSteps', () => ({ useLiveSteps: () => ({ activeNodes: { value: {} } }) }))

import { mountTatva } from './_mount'
import { server, http, HttpResponse, mockFrappeMethod } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'

const NODE_TYPES = [
  {
    type: 'Send WhatsApp',
    label: 'Send WhatsApp',
    description: 'Sends a template message.',
    outputs: ['sent', 'failed'],
    outcomes: ['delivered', 'read'],
    config: [],
  },
  {
    type: 'Wait',
    label: 'Wait',
    description: 'Suspends the run.',
    outputs: null,
    outcomes: [],
    config: [
      { name: 'mode', label: 'Mode', type: 'Select', control: 'select', primitive: true, summary: null, shapes_outputs: true, options: ['Until Event'], help: 'What ends the wait.' },
      { name: 'source_node', label: 'Waiting on', type: 'Node', control: 'graph-select', primitive: false, summary: null, shapes_outputs: false, help: 'Which earlier node this wait listens to.' },
    ],
  },
]

// The wait is NOT wired to the send: that edge is what the author draws while the panel is open.
const DEFINITION = {
  name: 'WF-LIVE-WIRING',
  canvas_json: null,
  nodes: [
    { node_id: 'send-1', node_type: 'Send WhatsApp', config_json: '{}', edges: [] },
    { node_id: 'wait-1', node_type: 'Wait', config_json: JSON.stringify({ mode: 'Until Event' }), edges: [] },
  ],
}

// Every graph the CONTEXT endpoint was asked about, in order — a stale input is then visible as data.
// Created PER MOUNT and closed over, never module-level: a previous test's canvas is still alive with a
// debounced reload in flight, and a shared array would collect its answer as if it were this one's.
function mockContext() {
  const asked = []
  server.use(
    http.post('*/api/method/tatva_connect.workflow_engine.context.node_context', async ({ request }) => {
      const body = await request.clone().json().catch(() => ({}))
      const nodes = typeof body.nodes === 'string' ? JSON.parse(body.nodes) : body.nodes || []
      asked.push(nodes)
      return HttpResponse.json({
        message: {
          subject: 'CRM Lead', grain: {}, variables: [], emitters: [], settable: [], working_set: [],
          operators_by_type: {}, operator_shapes: {},
        },
      })
    }),
  )
  return asked
}

async function mountCanvas() {
  mockFrappeMethod('tatva_connect.workflow_engine.registry.node_types', NODE_TYPES)
  mockFrappeMethod('tatva_connect.workflow_engine.history.node_counts', {})
  mockFrappeMethod('tatva_connect.workflow_engine.registry.graph_outputs', {
    'send-1': ['sent', 'failed'], 'wait-1': ['event'],
  })
  const asked = mockContext()

  const wrapper = mountTatva(WorkflowCanvas, {
    props: { definition: DEFINITION, editable: true, problems: [] },
  })
  await flushPromises()
  await flushPromises()
  return { wrapper, asked }
}

// What `onConnect` does when the author drags a handle onto a node. Driven here rather than through
// vue-flow's pointer events because the defect is not in `onConnect` — it always wrote this list. The
// defect is that nothing downstream ever read it.
function drawEdge(wrapper, source, sourceHandle, target) {
  wrapper.vm.edges = [
    ...wrapper.vm.edges,
    { id: `${source}__${sourceHandle}`, source, sourceHandle, target },
  ]
}

// The context request is debounced by 300ms, so the reload is awaited rather than assumed; the margin is generous on purpose, because this is REAL time against a real timer and a 50ms margin lost the race whenever enough suites ran beside it — a slow machine is not a defect in the wiring this file is about.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 800))
  await flushPromises()
}

function edgesFor(nodes, nodeId) {
  return (nodes.find((n) => n.node_id === nodeId)?.edges || []).map((e) => [e.from_output, e.to_node])
}

describe('WorkflowCanvas — the backend is asked about the wiring on screen', () => {
  it('sends an edge drawn since load, so a Wait can be offered the node above it', async () => {
    const { wrapper, asked } = await mountCanvas()
    wrapper.vm.selectedId = 'wait-1'
    await settle()
    expect(asked.length, 'the inspector must have asked at least once').toBeGreaterThan(0)
    expect(edgesFor(asked.at(-1), 'send-1'), 'nothing is wired yet').toEqual([])

    drawEdge(wrapper, 'send-1', 'sent', 'wait-1')
    await settle()

    // THE assertion: the walk that decides what a Wait may wait on reads exactly this.
    expect(edgesFor(asked.at(-1), 'send-1')).toEqual([['sent', 'wait-1']])
  })

  it('sends it for the VALUE picker too — the same payload answers both questions', async () => {
    // The second victim, and the half nobody would look for: `variables` and `emitters` come off the same
    // ancestor walk over the same `edges`, so a stale wire emptied the value picker as well.
    const { wrapper, asked } = await mountCanvas()
    wrapper.vm.selectedId = 'wait-1'
    await settle()

    drawEdge(wrapper, 'send-1', 'sent', 'wait-1')
    await settle()

    const posted = asked.at(-1)
    expect(posted.map((n) => n.node_id).sort()).toEqual(['send-1', 'wait-1'])
    // One payload, and it is complete: the node that produces values, and the wire that puts it upstream.
    expect(edgesFor(posted, 'send-1')).toEqual([['sent', 'wait-1']])
  })

  it('carries an edge the author REMOVED, so a picker narrows as well as widens', async () => {
    const { wrapper, asked } = await mountCanvas()
    wrapper.vm.selectedId = 'wait-1'
    drawEdge(wrapper, 'send-1', 'sent', 'wait-1')
    await settle()
    expect(edgesFor(asked.at(-1), 'send-1')).toEqual([['sent', 'wait-1']])

    wrapper.vm.edges = []
    await settle()
    expect(edgesFor(asked.at(-1), 'send-1')).toEqual([])
  })

  it('saves the same wiring it asked about', async () => {
    // ONE merge, so the graph the backend judged and the graph that gets stored cannot be two graphs.
    const { wrapper, asked } = await mountCanvas()
    wrapper.vm.selectedId = 'wait-1'
    drawEdge(wrapper, 'send-1', 'sent', 'wait-1')
    await settle()

    const saved = wrapper.vm.serialize()
    expect(edgesFor(saved.nodes, 'send-1')).toEqual(edgesFor(asked.at(-1), 'send-1'))
  })
})
