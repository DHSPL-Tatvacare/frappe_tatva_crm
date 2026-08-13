import { describe, it, expect } from 'vitest'
import { definitionToFlow, handlesForNode } from '@/tatva/workflows/graphMap'

// definitionToFlow is the function the canvas calls on every load, and it was the one function no unit
// test drove with real node rows. A `ReferenceError` inside it left the canvas blank on a workflow that
// had nodes and a published version, while vitest passed and a full frontend build reported clean.
// A BUILD IS NOT A PAGE.
//
// It now takes the backend's RESOLVED answer rather than a resolver. The previous version of this file
// hand-copied `outputs_for` — including rows_from — to produce that answer, so it proved the twin agreed
// with a fourth copy of the rule. What the canvas needs proving is that it DRAWS the answer it is given.

// The node rows exactly as the backend returns them: config as a JSON STRING, edges as {from_output, to_node}.
const NODE_ROWS = [
  {
    node_id: 'start',
    node_type: 'Trigger',
    config_json: JSON.stringify({
      subject_doctype: 'CRM Lead',
      event: 'Created',
    }),
    edges: [{ from_output: 'next', to_node: 'wa' }],
  },
  {
    node_id: 'wa',
    node_type: 'Send WhatsApp',
    config_json: JSON.stringify({
      contact_number: 'crm_lead.mobile_no',
      whatsapp_template: 'reminder-en',
      buttons: [{ id: 'yes' }, { id: 'no' }],
    }),
    edges: [
      { from_output: 'sent', to_node: 'w1' },
      { from_output: 'failed', to_node: 'dead' },
    ],
  },
  {
    node_id: 'w1',
    node_type: 'Wait',
    config_json: JSON.stringify({
      mode: 'Until Event',
      event_name: 'whatsapp.clicked',
      source_node: 'wa',
    }),
    edges: [
      { from_output: 'yes', to_node: 'said_yes' },
      { from_output: 'no', to_node: 'said_no' },
    ],
  },
  { node_id: 'said_yes', node_type: 'Terminal', config_json: '{}', edges: [] },
  { node_id: 'said_no', node_type: 'Terminal', config_json: '{}', edges: [] },
  { node_id: 'dead', node_type: 'Terminal', config_json: '{}', edges: [] },
]

// `registry.graph_outputs` for exactly that graph: the Wait sits under a send offering two buttons, so
// the backend resolves its outputs to one per button.
const OUTPUTS = {
  start: ['next'],
  wa: ['sent', 'failed'],
  w1: ['yes', 'no'],
  said_yes: [],
  said_no: [],
  dead: [],
}

describe('definitionToFlow — the function the canvas calls on load', () => {
  it('builds a node for every row', () => {
    const { flowNodes } = definitionToFlow(NODE_ROWS, null, OUTPUTS)

    expect(flowNodes).toHaveLength(6)
    expect(flowNodes.map((n) => n.id)).toEqual([
      'start',
      'wa',
      'w1',
      'said_yes',
      'said_no',
      'dead',
    ])
  })

  it('gives every node a position so Vue Flow can place it', () => {
    const { flowNodes } = definitionToFlow(NODE_ROWS, null, OUTPUTS)

    for (const n of flowNodes) {
      expect(n.position, `${n.id} has no position`).toBeTruthy()
      expect(typeof n.position.x).toBe('number')
    }
  })

  it('builds an edge per wired output, including the button branches', () => {
    const { flowEdges } = definitionToFlow(NODE_ROWS, null, OUTPUTS)

    const wired = flowEdges.map(
      (e) => `${e.source}:${e.sourceHandle}->${e.target}`,
    )
    expect(wired).toContain('wa:sent->w1')
    expect(wired).toContain('w1:yes->said_yes')
    expect(wired).toContain('w1:no->said_no')
  })

  it('draws one handle per declared button on the Wait', () => {
    const wait = NODE_ROWS.find((n) => n.node_id === 'w1')

    expect(handlesForNode(wait, OUTPUTS).map((h) => h.id)).toEqual([
      'yes',
      'no',
    ])
  })

  it('carries no graph copy onto the node — handles are the backend answer, passed as a prop', () => {
    // G5: `graphConfig` was mirrored onto every node so the card could resolve outputs itself. The card
    // no longer resolves anything, so the mirror is gone rather than left behind unused.
    const { flowNodes } = definitionToFlow(NODE_ROWS, null, OUTPUTS)

    expect(
      flowNodes.find((n) => n.id === 'w1').data.graphConfig,
    ).toBeUndefined()
  })

  it('labels the button edges so the canvas says which branch is which', () => {
    const { flowEdges } = definitionToFlow(NODE_ROWS, null, OUTPUTS)
    const yes = flowEdges.find(
      (e) => e.source === 'w1' && e.sourceHandle === 'yes',
    )

    expect(yes.label).toBe('yes')
  })

  it('survives an empty definition rather than throwing', () => {
    expect(() => definitionToFlow([], null, {})).not.toThrow()
  })

  // Nothing ever CHOSE the curve — no `type` was set, so Vue Flow fell back to its default bezier and
  // every branch of a many-output Route swept diagonally across its siblings. `smoothstep` is the
  // library's own built-in: an orthogonal path with rounded corners, no edge component, no path maths.
  it('declares the edge shape rather than inheriting one, on EVERY edge', () => {
    const { flowEdges } = definitionToFlow(NODE_ROWS, null, OUTPUTS)

    expect(flowEdges.length).toBeGreaterThan(0)
    for (const e of flowEdges) expect(e.type, `${e.id} inherited its shape`).toBe('smoothstep')
  })

  // The handle threshold moved (BOTTOM_MAX 6 -> 4) and a saved layout must not move with it: a position
  // stored by the author wins, and the auto-layout only ever runs for a node that has none.
  it('keeps every saved position exactly as it was stored', () => {
    const saved = { positions: { start: { x: 12, y: 34 }, w1: { x: 560, y: 780 } } }
    const { flowNodes } = definitionToFlow(NODE_ROWS, saved, OUTPUTS)
    const at = (id) => flowNodes.find((n) => n.id === id).position

    expect(at('start')).toEqual({ x: 12, y: 34 })
    expect(at('w1')).toEqual({ x: 560, y: 780 })
    // The rows with no stored position are the only ones the layout is allowed to place.
    expect(at('dead')).toBeTruthy()
  })
})
