// The canvas had none of the editing affordances Vue Flow already ships: nodes landed off-grid, a selection was one node, and there was no way to line up a row of boxes or copy one — so every assertion drives the REAL canvas and the REAL Vue Flow store, with selection made through Vue Flow's own `addSelectedNodes` rather than by poking a private ref, because a parallel selection set is the defect.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { VueFlow } from '@vue-flow/core'

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/tatva/workflows/liveSteps', () => ({
  useLiveSteps: () => ({ activeNodes: { value: {} } }),
}))

import { mountTatva } from './_mount'
import { mockFrappeMethod, mockGraphContext } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'
import NodeInspector from '@/tatva/workflows/NodeInspector.vue'

const NODE_TYPES = [
  {
    type: 'Add Note',
    label: 'Add Note',
    description: 'Adds a note.',
    outputs: ['next'],
    outcomes: [],
    singleton: false,
    config: [],
  },
  {
    type: 'Trigger',
    label: 'Trigger',
    description: 'Starts the workflow.',
    outputs: ['next'],
    outcomes: [],
    singleton: true,
    config: [],
  },
]

// Three notes at known, deliberately ragged positions — enough to prove align AND distribute; the values are deliberately ragged, which is the state align and distribute exist to fix.
const POSITIONS = {
  a: { x: 48, y: 96 },
  b: { x: 96, y: 240 },
  c: { x: 192, y: 432 },
}

const definition = () => ({
  name: 'WF-EDIT',
  canvas_json: JSON.stringify({ positions: POSITIONS }),
  nodes: ['a', 'b', 'c'].map((id) => ({
    node_id: id,
    node_type: 'Add Note',
    config_json: JSON.stringify({ body: id }),
    edges: [],
  })),
})

async function mountCanvas(editable = true) {
  mockFrappeMethod(
    'tatva_connect.workflow_engine.registry.node_types',
    NODE_TYPES,
  )
  mockFrappeMethod('tatva_connect.workflow_engine.history.node_counts', {})
  mockGraphContext({
    outputs: { a: ['next'], b: ['next'], c: ['next'] },
    subject: 'CRM Lead',
    grain: {},
    variables: [],
    emitters: [],
    settable: [],
    operators_by_type: {},
    operator_shapes: {},
  })
  const wrapper = mountTatva(WorkflowCanvas, {
    props: { definition: definition(), editable, problems: [] },
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

// Vue Flow's own selection API, reached through the instance it exposes — the same store the canvas reads.
async function select(wrapper, ids) {
  const flow = wrapper.findComponent(VueFlow).vm.$.exposed
  flow.addSelectedNodes(ids.map((id) => flow.findNode(id)))
  await nextTick()
  return flow
}

function positionOf(wrapper, id) {
  return wrapper.vm.nodes.find((n) => n.id === id).position
}

describe('WorkflowCanvas — the editing affordances Vue Flow already provides', () => {
  // Asserted on the STORE the canvas is actually running with, not on the props it happened to pass — one of these values is the library's own default, and passing it is all a prop assertion would prove.
  const configOf = (wrapper) => wrapper.findComponent(VueFlow).vm.$.exposed

  it('does not snap: a node goes exactly where the author drops it', async () => {
    // Owner decision. 16 was too fine to read as snapping and only added jitter; 48 clicked into place but was not the feel wanted. Align and distribute are the tidy-up instead.
    const wrapper = await mountCanvas()
    expect(configOf(wrapper).snapToGrid.value).toBe(false)
  })

  it('shift adds to the selection and shift-drag lassoes, with panning left alone', async () => {
    const flow = configOf(await mountCanvas())
    expect(flow.multiSelectionKeyCode.value).toBe('Shift')
    expect(flow.selectionKeyCode.value).toBe('Shift')
    expect(flow.selectionMode.value).toBe('partial')
    expect(flow.panOnDrag.value).toBe(true)
  })

  it('a multi-selection never silently edits one node — it names the count instead', async () => {
    const wrapper = await mountCanvas()
    wrapper.vm.selectedId = 'a'
    await flushPromises()
    expect(wrapper.findComponent(NodeInspector).exists()).toBe(true)

    await select(wrapper, ['a', 'b'])
    expect(wrapper.findComponent(NodeInspector).exists()).toBe(false)
    expect(wrapper.text()).toContain('2 nodes selected')
  })

  it('aligns the selection left, and the move is unsaved work', async () => {
    const wrapper = await mountCanvas()
    await select(wrapper, ['a', 'b', 'c'])
    wrapper.vm.markClean()
    await nextTick()

    wrapper.vm.alignSelection('left')
    await nextTick()

    expect(positionOf(wrapper, 'a').x).toBe(48)
    expect(positionOf(wrapper, 'b').x).toBe(48)
    expect(positionOf(wrapper, 'c').x).toBe(48)
    expect(wrapper.vm.dirty).toBe(true)
  })

  it('aligns the selection to the top without touching the axis it was not asked about', async () => {
    const wrapper = await mountCanvas()
    await select(wrapper, ['a', 'b', 'c'])
    wrapper.vm.alignSelection('top')
    await nextTick()

    expect(positionOf(wrapper, 'c').y).toBe(96)
    expect(positionOf(wrapper, 'c').x).toBe(192)
  })

  it('distributes vertically: the ends stay put and the gaps come out even', async () => {
    const wrapper = await mountCanvas()
    await select(wrapper, ['a', 'b', 'c'])
    wrapper.vm.distributeSelection('y')
    await nextTick()

    expect(positionOf(wrapper, 'a').y).toBe(96)
    expect(positionOf(wrapper, 'c').y).toBe(432)
    expect(positionOf(wrapper, 'b').y).toBe(264)
  })

  it('distributes on the real box, so a column of mixed heights gets even GAPS not even tops', async () => {
    // The fixture measures nothing, so a position-even and a gap-even distribute agree on it — this is the case that tells them apart. A node's height is a function of its output count (graphMap NODE_H), so mixed heights are the normal case on a real graph.
    const wrapper = await mountCanvas()
    const flow = await select(wrapper, ['a', 'b', 'c'])
    const HEIGHT = { a: 200, b: 100, c: 100 }
    for (const id of ['a', 'b', 'c']) flow.findNode(id).dimensions = { width: 240, height: HEIGHT[id] }
    await nextTick()

    wrapper.vm.distributeSelection('y')
    await nextTick()

    // The gap is what a reader sees, so the gap is what is asserted — not a pixel that snapping may move.
    const y = (id) => positionOf(wrapper, id).y
    const gapAB = y('b') - (y('a') + HEIGHT.a)
    const gapBC = y('c') - (y('b') + HEIGHT.b)
    expect(gapAB).toBe(gapBC)
    expect(y('a')).toBe(96)
    expect(y('c')).toBe(432)
  })

  it('pastes a copied node under a NEW id, carrying its settings and none of its wiring', async () => {
    const wrapper = await mountCanvas()
    await select(wrapper, ['a'])
    wrapper.vm.markClean()
    await nextTick()

    wrapper.vm.copySelection()
    wrapper.vm.pasteClipboard()
    await nextTick()

    expect(wrapper.vm.nodes).toHaveLength(4)
    const pasted = wrapper.vm.nodes.find((n) => !['a', 'b', 'c'].includes(n.id))
    expect(pasted.id).not.toBe('a')
    expect(pasted.data.node.node_id).toBe(pasted.id)
    expect(pasted.data.node.config_json).toBe(JSON.stringify({ body: 'a' }))
    expect(pasted.data.node.edges).toEqual([])
    expect(wrapper.vm.edges.filter((e) => e.source === pasted.id)).toHaveLength(
      0,
    )
    expect(wrapper.vm.dirty).toBe(true)
  })

  it('is all editor-only — a read-only canvas moves nothing and pastes nothing', async () => {
    const wrapper = await mountCanvas(false)
    await select(wrapper, ['a', 'b'])

    wrapper.vm.copySelection()
    wrapper.vm.pasteClipboard()
    wrapper.vm.alignSelection('left')
    await nextTick()

    expect(wrapper.vm.nodes).toHaveLength(3)
    expect(positionOf(wrapper, 'b').x).toBe(96)
  })
})
