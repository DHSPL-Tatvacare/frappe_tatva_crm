// The inspector is where a condition is authored, and a predicate row is ~564px of controls (field 176 + operator 160 + value 176 + delete ~28 + gaps 24); it opened at 288px and forgot every drag, so the author re-widened it on every node click and every reload — both halves are asserted here through the REAL canvas, the width the panel opens at and the width surviving a fresh mount.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/tatva/workflows/liveSteps', () => ({
  useLiveSteps: () => ({ activeNodes: { value: {} } }),
}))

import { mountTatva } from './_mount'
import { mockFrappeMethod, mockGraphContext } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'
import NodeInspector from '@/tatva/workflows/NodeInspector.vue'
import Resizer from '@/components/Resizer.vue'

// The floor, MEASURED: a predicate row is `flex-wrap`, so at 384 it takes a third line and the value box
// renders wider (289px) than it did at 480 (217px). The sliver the old 480 guarded against is prevented by
// the wrap, not by the width. The ceiling keeps the graph on screen beside the panel.
const PREDICATE_ROW_FLOOR = 384
const INSPECTOR_CEILING = 512
// Bumped whenever the default moves, so an author who never dragged is not left on the old width.
const WIDTH_KEY = 'tatva:workflow-inspector-width:384'

const NODE_TYPES = [
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

const definition = () => ({
  name: 'WF-WIDTH',
  canvas_json: null,
  nodes: [
    {
      node_id: 'trigger-1',
      node_type: 'Trigger',
      config_json: '{}',
      edges: [],
    },
  ],
})

async function mountCanvas() {
  mockFrappeMethod(
    'tatva_connect.workflow_engine.registry.node_types',
    NODE_TYPES,
  )
  mockFrappeMethod('tatva_connect.workflow_engine.history.node_counts', {})
  mockGraphContext({
    outputs: { 'trigger-1': ['next'] },
    subject: 'CRM Lead',
    grain: {},
    variables: [],
    emitters: [],
    settable: [],
    operators_by_type: {},
    operator_shapes: {},
  })
  const wrapper = mountTatva(WorkflowCanvas, {
    props: { definition: definition(), editable: true, problems: [] },
  })
  await flushPromises()
  wrapper.vm.selectedId = 'trigger-1'
  await flushPromises()
  return wrapper
}

describe('WorkflowCanvas — the inspector opens wide enough, and stays where it was dragged', () => {
  beforeEach(() => localStorage.clear())

  it('opens at a width a predicate row can actually lay out in', async () => {
    const wrapper = await mountCanvas()
    expect(wrapper.vm.inspectorWidth).toBeGreaterThanOrEqual(
      PREDICATE_ROW_FLOOR,
    )
  })

  it('is sized by the CRM own Resizer, not by a width of its own', async () => {
    // The panel used to carry a `width` prop and paint its own inline style. Both are gone: `Resizer` is what every other side panel in this app is sized by, and it owns the drag, the clamp and the snap.
    const wrapper = await mountCanvas()
    const resizer = wrapper.findComponent(Resizer)
    expect(resizer.exists()).toBe(true)
    expect(resizer.props('side')).toBe('right')
    expect(resizer.props('defaultWidth')).toBe(wrapper.vm.inspectorWidth)
    expect(resizer.props('minWidth')).toBeGreaterThanOrEqual(PREDICATE_ROW_FLOOR)
    expect(wrapper.findComponent(NodeInspector).exists()).toBe(true)
  })

  it('a dragged width survives a fresh visit — it is set once, not once per session', async () => {
    const first = await mountCanvas()
    first.vm.inspectorWidth = 500
    await nextTick()
    first.unmount()

    const second = await mountCanvas()
    expect(second.vm.inspectorWidth).toBe(500)
  })

  it('a width remembered from before the floor moved is lifted to the floor', async () => {
    localStorage.setItem(WIDTH_KEY, '288')
    const wrapper = await mountCanvas()
    expect(wrapper.vm.inspectorWidth).toBeGreaterThanOrEqual(PREDICATE_ROW_FLOOR)
  })

  it('a width remembered from above the ceiling is brought back down', async () => {
    // The old panel opened at 640. Lowering the ceiling without clamping would leave that author wider
    // than the canvas now allows, with no drag able to explain why.
    localStorage.setItem(WIDTH_KEY, '640')
    const wrapper = await mountCanvas()
    expect(wrapper.vm.inspectorWidth).toBeLessThanOrEqual(INSPECTOR_CEILING)
  })

  it('the panel never opens wider than the ceiling', async () => {
    const wrapper = await mountCanvas()
    expect(wrapper.findComponent(Resizer).props('maxWidth')).toBe(INSPECTOR_CEILING)
  })

  it('a width stored under the previous generation of the key does not stick', async () => {
    // `useStorage` seeds the key with the floor, so an author who never dragged has the OLD default stored
    // and looks identical to one who chose it. The key carries the generation so a changed default lands.
    localStorage.setItem('tatva:workflow-inspector-width', '480')
    const wrapper = await mountCanvas()
    expect(wrapper.vm.inspectorWidth).toBe(PREDICATE_ROW_FLOOR)
  })
})
