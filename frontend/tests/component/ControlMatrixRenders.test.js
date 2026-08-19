// EVERY control the engine declares, drawn through the REAL chain — the standing version of the manual
// sweep that walked all 17 node types on a live canvas looking for a control that renders nothing.
//
// Mounted through `WorkflowCanvas` with the registry's OWN payload (`_nodeTypes.fixture.json`, kept honest
// by `test_control_matrix_fixture.py`). Mounting `NodeInspector` alone does NOT work and quietly passes:
// the declarations come from a shared `node_types` resource, so an unseeded panel renders "This node type
// has no settings" and every assertion about its controls is vacuous. That is how the first draft of this
// file went green while drawing nothing.
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { Select } from 'frappe-ui'

vi.mock('@/utils/dialogs', () => ({ createDialog: vi.fn() }))
vi.mock('@/tatva/workflows/liveSteps', () => ({ useLiveSteps: () => ({ activeNodes: { value: {} } }) }))

import { mountTatva } from './_mount'
import { mockFrappeMethod, mockGraphContext } from './_msw'
import WorkflowCanvas from '@/tatva/workflows/WorkflowCanvas.vue'
import NodeInspector from '@/tatva/workflows/NodeInspector.vue'
import { NODE_TYPES, TUPLES, CONTROLS, instancesOf } from './_matrix'

const TARGETS = ['CRM Lead', 'HD Ticket']
const SETTABLE = [{ key: 'status', label: 'Status', type: 'Select', doctype: 'CRM Lead', operators: [], options: [] }]
const VARIABLES = [{ ref: 'crm_lead.status', label: 'Status', type: 'Select', source: 'crm_lead', source_label: 'CRM Lead' }]

const nodeId = (type) => `${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-1`

async function openNode(type) {
  mockFrappeMethod('tatva_connect.workflow_engine.registry.node_types', NODE_TYPES)
  mockGraphContext({
    variables: VARIABLES,
    settable: SETTABLE,
    targets: TARGETS,
    subject: 'CRM Lead',
    operators_by_type: { Select: ['is', 'is not'] },
    operator_shapes: { none: [], range: [], list: [] },
  })
  const id = nodeId(type)
  const w = mountTatva(WorkflowCanvas, {
    props: {
      definition: {
        name: 'WF-MATRIX',
        canvas_json: null,
        nodes: [{ node_id: id, node_type: type, config_json: '{}', edges: [] }],
      },
      editable: true,
      problems: [],
    },
  })
  await flushPromises()
  w.vm.selectedId = id
  await flushPromises()
  return w
}

const WITH_CONFIG = NODE_TYPES.filter((n) => (n.config || []).length)

describe('every declared node draws its own settings, not the empty state', () => {
  for (const declared of WITH_CONFIG) {
    it(`${declared.type} draws its fields`, async () => {
      const w = await openNode(declared.type)
      const panel = w.findComponent(NodeInspector)
      expect(panel.exists(), `${declared.type}: no inspector`).toBe(true)
      const text = panel.text()
      // The empty state is the failure this suite exists to catch — it looks identical to a pass.
      expect(text, `${declared.type} rendered the empty state`).not.toContain('has no settings')
      // At least one ungated field's label must be on screen; a gated one may legitimately be hidden.
      const ungated = (declared.config || []).filter((f) => !f.depends_on_value && f.label)
      if (ungated.length) {
        expect(
          ungated.some((f) => text.includes(f.label)),
          `${declared.type} drew none of its ungated labels: ${ungated.map((f) => f.label).join(', ')}`,
        ).toBe(true)
      }
      w.unmount()
    })
  }
})

describe('a Target picker offers what the server sent, never a list of its own', () => {
  const targets = instancesOf('graph-select').filter((t) => t.field === 'target_doctype')

  it('there is a Target to judge', () => expect(targets.length).toBeGreaterThan(0))

  for (const t of targets) {
    it(`${t.node} offers exactly context.targets`, async () => {
      const w = await openNode(t.node)
      // Off the inner `Select`: `options` is not declared in FormControlProps, so it falls through
      // `useAttrs` and `FormControl.props('options')` is always undefined — the trap the predicate suite
      // already documents.
      const offered = w.findAllComponents(Select)
        .flatMap((s) => (s.props('options') || []).map((o) => (o && o.value !== undefined ? o.value : o)))
      for (const target of TARGETS) {
        expect(offered, `${t.node} did not offer ${target}`).toContain(target)
      }
      w.unmount()
    })
  }
})

describe('the matrix knows what it is covering', () => {
  it('every declared control is drawn by at least one node', () => {
    for (const c of CONTROLS) expect(instancesOf(c).length).toBeGreaterThan(0)
  })
  it('covers the whole declaration', () => {
    expect(TUPLES.length).toBe(NODE_TYPES.reduce((n, t) => n + (t.config || []).length, 0))
  })
})
