import { describe, it, expect } from 'vitest'
import {
  definitionToFlow,
  handlesForNode,
  outputsQueryKey,
} from '@/tatva/workflows/graphMap'

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
})

// The canvas asks `graph_outputs` from two places with the same graph in two shapes — the loaded rows, and
// those rows merged with the live edges. The endpoint reads only id, type and config (registry.py:1038),
// never edges, so both shapes are the SAME question and must produce the same key. Without that they were
// asked separately on every load, and again on every edge drag.
describe('outputsQueryKey — one question, one key', () => {
  const rows = [
    {
      node_id: 'b',
      node_type: 'Wait',
      config_json: '{"mode":"For Duration"}',
      edges: [{ from_output: 'next', to_node: 'c' }],
    },
    {
      node_id: 'a',
      node_type: 'Trigger',
      config_json: '{"event":"Created"}',
      edges: [{ from_output: 'next', to_node: 'b' }],
    },
  ]

  it('ignores edges, because the endpoint does', () => {
    const rewired = rows.map((r) => ({
      ...r,
      edges: [{ from_output: 'next', to_node: 'zzz' }],
    }))
    expect(outputsQueryKey(rewired)).toBe(outputsQueryKey(rows))
  })

  it('ignores the order the nodes arrive in', () => {
    expect(outputsQueryKey([...rows].reverse())).toBe(outputsQueryKey(rows))
  })

  it('changes when a config changes, so a shape change still refetches', () => {
    const edited = rows.map((r) =>
      r.node_id === 'b' ? { ...r, config_json: '{"mode":"Until Event"}' } : r,
    )
    expect(outputsQueryKey(edited)).not.toBe(outputsQueryKey(rows))
  })

  it('changes when a node is added or removed', () => {
    expect(outputsQueryKey(rows.slice(1))).not.toBe(outputsQueryKey(rows))
  })
})
