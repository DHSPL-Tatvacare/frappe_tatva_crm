// Severity drives colour, and the backend owns severity (C17.1) — the inspector renders the answer, it
// does not decide it. A `blocks` fault is red, a `warns` fault amber, and each carries a muted `fix` line.
// Proven through the real reactive chain (WorkflowCanvas → NodeInspector), not by reading the map: the
// defect this guards is a hardcoded `text-ink-red-4` that paints a true-but-not-fatal warning as an error.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

// Same shims WorkflowCanvasPrune.test.js uses: dialogs.jsx pulls react, and live-run reaches a socket —
// neither is the contract under test.
vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/tatva/workflows/liveSteps', () => ({ useLiveSteps: () => ({ activeNodes: { value: {} } }) }))

import { mountTatva } from './_mount'
import { mockFrappeMethod, mockGraphContext } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'
import NodeInspector from '@/tatva/workflows/NodeInspector.vue'

const NODE_TYPES = [
  {
    type: 'Send WhatsApp',
    label: 'Send WhatsApp',
    description: 'Sends a template message.',
    outputs: ['sent', 'failed'],
    outcomes: [],
    config: [
      // `value-picker` is what `registry.FIELD_TYPES['Variable']` really declares. This fixture said
      // `variable`, a control name the inspector has no branch for — so it silently fell through to the
      // default FormControl and the assertions below were anchored on a control the app never renders.
      { name: 'contact_number', label: 'Contact number', type: 'Variable', control: 'value-picker',
        primitive: false, summary: null, shapes_outputs: false, reqd: true },
    ],
  },
  { type: 'Terminal', label: 'End', description: 'Ends the run.', outputs: [], outcomes: [], config: [] },
]

const DEFINITION = {
  name: 'WF-SEVERITY',
  canvas_json: null,
  nodes: [
    { node_id: 'send-1', node_type: 'Send WhatsApp', config_json: '{}',
      edges: [{ from_output: 'sent', to_node: 'end-1' }] },
    { node_id: 'end-1', node_type: 'Terminal', config_json: '{}', edges: [] },
  ],
}

// One of each severity on the same node: a blocking field fault and a graph-level (node) warning.
const PROBLEMS = [
  { node_id: 'send-1', field: 'contact_number', severity: 'blocks',
    message: 'Send WhatsApp needs Contact number.', fix: 'Fill in Contact number.', code: 'field.required' },
  { node_id: 'send-1', field: null, severity: 'warns',
    message: 'The workflow engine is switched off, so this workflow will not run until an operator turns it on.',
    fix: 'Ask an operator to enable the switch.', code: 'engine.muted' },
]

async function mountCanvas() {
  mockFrappeMethod('tatva_connect.workflow_engine.registry.node_types', NODE_TYPES)
  mockFrappeMethod('tatva_connect.workflow_engine.history.node_counts', {})
  // The canvas resolves outputs server-side on mount; a constant answer is fine — outputs are not this contract.
  mockGraphContext({
    outputs: { 'send-1': ['sent', 'failed'], 'end-1': [] },
    subject: 'CRM Lead', grain: {}, variables: [], emitters: [], settable: [],
    operators_by_type: {}, operator_shapes: {},
  })
  const wrapper = mountTatva(WorkflowCanvas, {
    props: { definition: DEFINITION, editable: true, problems: PROBLEMS },
  })
  await flushPromises()
  wrapper.vm.selectedId = 'send-1'
  await flushPromises()
  return wrapper
}

describe('the inspector colours a fault by its backend severity', () => {
  let inspector

  beforeEach(async () => {
    const wrapper = await mountCanvas()
    inspector = wrapper.findComponent(NodeInspector)
    expect(inspector.exists(), 'the inspector must mount for this to be the real chain').toBe(true)
  })

  it('paints a blocking fault red', () => {
    const red = inspector.findAll('.text-ink-red-4').map((n) => n.text())
    expect(red.some((t) => t.includes('needs Contact number'))).toBe(true)
  })

  it('paints a warning amber, not red', () => {
    const amber = inspector.findAll('.text-ink-amber-3').map((n) => n.text())
    expect(amber.some((t) => t.includes('switched off'))).toBe(true)
    // The whole point: the warning is NOT painted with the block colour.
    const red = inspector.findAll('.text-ink-red-4').map((n) => n.text())
    expect(red.some((t) => t.includes('switched off'))).toBe(false)
  })

  it('renders the fix as a muted second line under each fault', () => {
    const muted = inspector.findAll('.text-ink-gray-5').map((n) => n.text())
    expect(muted.some((t) => t.includes('Fill in Contact number'))).toBe(true)
    expect(muted.some((t) => t.includes('enable the switch'))).toBe(true)
  })
})
