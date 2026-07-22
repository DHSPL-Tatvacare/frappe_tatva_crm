import { describe, it, expect } from 'vitest'
import { pruneInvalidEdges } from '@/tatva/workflows/graphMap'

// `pruneInvalidEdges` runs on every shape change and DELETES edges. An author who loses a wired branch
// loses it silently, so what it does is proven here rather than argued.
//
// It now takes the backend's RESOLVED answer — {node_id: [output]} exactly as `registry.graph_outputs`
// returns it. The previous version of this file hand-copied `outputs_for` into the test to produce that
// answer, which meant the test agreed with a JS twin rather than with the engine: a third copy of the
// rule, green for ever while the real one drifted. Supplying the answer is the point.

function node(id, node_type) {
  return { id, data: { node: { node_id: id, node_type, config_json: '{}' } } }
}

function edge(source, sourceHandle, target) {
  return { id: `${source}-${sourceHandle}-${target}`, source, sourceHandle, target }
}

describe('pruneInvalidEdges — what survives a shape change', () => {
  it('keeps a Wait wired on its event handle', () => {
    const nodes = [node('wa', 'Send WhatsApp'), node('w1', 'Wait'), node('end', 'Terminal')]
    const edges = [edge('wa', 'sent', 'w1'), edge('w1', 'event', 'end')]
    const outputs = { wa: ['sent', 'failed'], w1: ['event'], end: [] }

    expect(pruneInvalidEdges(nodes, edges, outputs)).toHaveLength(2)
  })

  it('KEEPS a Wait branch wired on a button the send declared', () => {
    // The rows_from case — the answer the backend gives when a Wait sits under a send offering buttons.
    const nodes = [node('wa', 'Send WhatsApp'), node('w1', 'Wait'), node('end', 'Terminal')]
    const edges = [edge('w1', 'yes', 'end'), edge('w1', 'no', 'end')]
    const outputs = { wa: ['sent', 'failed'], w1: ['yes', 'no'], end: [] }

    expect(pruneInvalidEdges(nodes, edges, outputs)).toHaveLength(2)
  })

  it('prunes a branch for a button the send no longer declares', () => {
    const nodes = [node('wa', 'Send WhatsApp'), node('w1', 'Wait'), node('end', 'Terminal')]
    const edges = [edge('w1', 'yes', 'end'), edge('w1', 'no', 'end')]
    const outputs = { wa: ['sent', 'failed'], w1: ['yes'], end: [] }

    const kept = pruneInvalidEdges(nodes, edges, outputs)

    expect(kept).toHaveLength(1)
    expect(kept[0].sourceHandle).toBe('yes')
  })

  it('prunes a timeout edge when the mode no longer declares one', () => {
    const nodes = [node('w1', 'Wait'), node('end', 'Terminal')]
    const edges = [edge('w1', 'event', 'end'), edge('w1', 'timeout', 'end')]

    const kept = pruneInvalidEdges(nodes, edges, { w1: ['event'], end: [] })

    expect(kept).toHaveLength(1)
    expect(kept[0].sourceHandle).toBe('event')
  })

  it('drops everything for a node the answer does not mention, rather than guessing', () => {
    // An absent node is not an invitation to invent handles: the backend is the only source, and a
    // missing entry means "no outputs", never "keep whatever was there".
    const nodes = [node('w1', 'Wait')]
    expect(pruneInvalidEdges(nodes, [edge('w1', 'event', 'end')], {})).toHaveLength(0)
  })
})
