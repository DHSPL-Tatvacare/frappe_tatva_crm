// THE KEY THAT DECIDES WHETHER THE SERVER IS ASKED AGAIN.
//
// Measured 2026-08-12: typing 24 characters into a Create Task Subject fired 25 `graph_outputs` calls,
// because the old key hashed every character of every node's config, so each keystroke was by construction
// a "distinct question" and the guard written to prevent duplicate asks guaranteed them. The answer could
// not have moved: outputs resolve from the fields the REGISTRY declares, and the authoring half from the
// Trigger, the wiring and what each node writes.
//
// So the key is read off the SAME declaration the server resolves with — `declarationFor(node_type)`, the
// table the client already caches. There is no list of field names here and there must never be one: a
// hand list is a second brain, and that is exactly how `outputs_for` got re-implemented in JS and rendered
// zero nodes for a day.
import { describe, it, expect } from 'vitest'
import { meaningKey, withLiveEdges } from '@/tatva/workflows/graphMap'

// The declarations exactly as `registry.node_types` puts them on the wire: `primitive` and `options` come
// off FIELD_TYPES, `shapes_outputs` is the registry's own marker for the field a type keys its handles on.
const DECLARED = {
  Trigger: {
    type: 'Trigger',
    singleton: true,
    config: [
      { name: 'subject_doctype', type: 'Select', primitive: true, shapes_outputs: false, options: ['CRM Lead', 'CRM Task'] },
      { name: 'event', type: 'Select', primitive: true, shapes_outputs: false, options: ['Created', 'Updated'] },
      { name: 'program', type: 'Grain', primitive: false, shapes_outputs: false },
      { name: 'working_set', type: 'Field Set', primitive: false, shapes_outputs: false },
      { name: 'predicate', type: 'Predicate', primitive: false, shapes_outputs: false },
    ],
  },
  'Create Task': {
    type: 'Create Task',
    config: [
      { name: 'subject_mode', type: 'Select', primitive: true, shapes_outputs: false, options: ['Literal', 'Expression'] },
      { name: 'subject_text', type: 'Data', primitive: true, shapes_outputs: false },
      { name: 'subject_expression', type: 'Small Text', primitive: true, shapes_outputs: false },
      { name: 'task_type', type: 'Link', primitive: false, shapes_outputs: false },
    ],
  },
  'Send WhatsApp': {
    type: 'Send WhatsApp',
    config: [{ name: 'buttons', type: 'Button List', primitive: false, shapes_outputs: false }],
  },
  Wait: {
    type: 'Wait',
    config: [
      { name: 'mode', type: 'Select', primitive: true, shapes_outputs: true, options: ['Until Event', 'For Duration'] },
      { name: 'source_node', type: 'Node', primitive: false, shapes_outputs: false },
    ],
  },
  Route: {
    type: 'Route',
    config: [{ name: 'routes', type: 'Route Rows', primitive: false, shapes_outputs: true }],
  },
  Terminal: { type: 'Terminal', config: [] },
}

const declarationFor = (type) => DECLARED[type] || null

function node(node_id, node_type, config = {}, edges = []) {
  return { node_id, node_type, config_json: JSON.stringify(config), edges }
}

// A graph that exercises every route into the key: a grain-declaring Trigger, a typed Subject, declared
// rows, and a Wait reading a SIBLING's buttons.
function graph() {
  return [
    node('trigger-1', 'Trigger', { subject_doctype: 'CRM Lead', event: 'Created', program: 'Anaya' }, [
      { from_output: 'next', to_node: 'task-1' },
    ]),
    node('task-1', 'Create Task', { subject_mode: 'Literal', subject_text: 'First Order Punch' }, [
      { from_output: 'next', to_node: 'send-1' },
    ]),
    node('send-1', 'Send WhatsApp', { buttons: [{ id: 'yes', label: 'Yes' }] }, [
      { from_output: 'sent', to_node: 'wait-1' },
    ]),
    node('wait-1', 'Wait', { mode: 'Until Event', source_node: 'send-1' }, [
      { from_output: 'yes', to_node: 'route-1' },
    ]),
    node('route-1', 'Route', { routes: [{ id: 'r1', label: 'North' }] }, [
      { from_output: 'r1', to_node: 'end-1' },
      { from_output: 'otherwise', to_node: 'end-1' },
    ]),
    node('end-1', 'Terminal', {}, []),
  ]
}

// Edit one node's config, the way the inspector does — a whole new `config_json` on that row.
function edited(rows, nodeId, changes) {
  return rows.map((r) =>
    r.node_id === nodeId
      ? { ...r, config_json: JSON.stringify({ ...JSON.parse(r.config_json), ...changes }) }
      : r,
  )
}

const keyOf = (rows) => meaningKey(rows, declarationFor)

describe('meaningKey — typing never changes what a graph MEANS', () => {
  it('is unmoved by a Create Task Subject, character by character', () => {
    // The measured defect, as data: 24 keystrokes, 24 distinct configs, ONE question.
    const base = keyOf(graph())
    const typed = 'First Order Punch EDITED'
    for (let i = 1; i <= typed.length; i++) {
      expect(keyOf(edited(graph(), 'task-1', { subject_text: typed.slice(0, i) }))).toBe(base)
    }
  })

  it('is unmoved by an expression typed into the same node', () => {
    expect(keyOf(edited(graph(), 'task-1', { subject_expression: 'a + b' }))).toBe(keyOf(graph()))
  })
})

describe('meaningKey — everything the answer really depends on moves it', () => {
  it('moves when a Route row label is edited, because a row IS a handle', () => {
    const rows = graph()
    const changed = rows.map((r) =>
      r.node_id === 'route-1'
        ? { ...r, config_json: JSON.stringify({ routes: [{ id: 'r1', label: 'South' }] }) }
        : r,
    )
    expect(keyOf(changed)).not.toBe(keyOf(rows))
  })

  it("moves when a Wait's mode changes — the field the declaration marks `shapes_outputs`", () => {
    expect(keyOf(edited(graph(), 'wait-1', { mode: 'For Duration' }))).not.toBe(keyOf(graph()))
  })

  it('moves when a Wait is pointed at a different node — its handles are a fact about THAT node', () => {
    expect(keyOf(edited(graph(), 'wait-1', { source_node: 'task-1' }))).not.toBe(keyOf(graph()))
  })

  it("moves when a button is added to the SEND, which is what leaves the Wait below it", () => {
    const changed = edited(graph(), 'send-1', {
      buttons: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
    })
    expect(keyOf(changed)).not.toBe(keyOf(graph()))
  })

  it("moves when the Trigger's subject changes — the whole authoring answer hangs off it", () => {
    expect(keyOf(edited(graph(), 'trigger-1', { subject_doctype: 'CRM Task' }))).not.toBe(keyOf(graph()))
  })

  it("moves when the Trigger's grain changes, because every picker below is scoped by it", () => {
    expect(keyOf(edited(graph(), 'trigger-1', { program: 'Zone' }))).not.toBe(keyOf(graph()))
  })

  it('moves when an edge is drawn', () => {
    const rows = graph().map((r) =>
      r.node_id === 'end-1' ? { ...r, edges: [{ from_output: 'next', to_node: 'task-1' }] } : r,
    )
    expect(keyOf(rows)).not.toBe(keyOf(graph()))
  })

  it('moves when an edge is deleted', () => {
    const rows = graph().map((r) => (r.node_id === 'send-1' ? { ...r, edges: [] } : r))
    expect(keyOf(rows)).not.toBe(keyOf(graph()))
  })

  it('moves when a node is added or removed', () => {
    expect(keyOf(graph().slice(1))).not.toBe(keyOf(graph()))
  })

  it('moves when a node keeps its id and changes its type', () => {
    const rows = graph().map((r) => (r.node_id === 'end-1' ? { ...r, node_type: 'Route' } : r))
    expect(keyOf(rows)).not.toBe(keyOf(graph()))
  })
})

describe('meaningKey — one question, one key', () => {
  it('ignores the order the nodes arrive in', () => {
    expect(keyOf([...graph()].reverse())).toBe(keyOf(graph()))
  })

  it('is the same for the loaded rows and for those rows merged with the live edges', () => {
    // The two shapes the canvas holds one graph in. A raw stringify saw two payloads for one question and
    // asked it twice on every load, and again on every edge drag.
    const flowNodes = graph().map((n) => ({ id: n.node_id, data: { node: { ...n } } }))
    const flowEdges = graph().flatMap((n) =>
      n.edges.map((e) => ({ source: n.node_id, sourceHandle: e.from_output, target: e.to_node })),
    )
    expect(keyOf(withLiveEdges(flowNodes, flowEdges))).toBe(keyOf(graph()))
  })

  it('survives an empty graph and a missing declaration table rather than throwing', () => {
    expect(() => meaningKey([], declarationFor)).not.toThrow()
    expect(() => meaningKey(graph(), undefined)).not.toThrow()
  })

  it('falls back to the WHOLE config for a type it has no declaration for', () => {
    // Conservative on purpose: with nothing declared there is nothing to read, and over-asking is a wasted
    // round trip while under-asking is a handle that never redraws.
    const unknown = [node('x-1', 'Not In The Registry', { anything: 'a' }, [])]
    const changed = [node('x-1', 'Not In The Registry', { anything: 'b' }, [])]
    expect(keyOf(changed)).not.toBe(keyOf(unknown))
  })
})
