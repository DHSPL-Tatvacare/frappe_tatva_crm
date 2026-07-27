import { describe, it, expect } from 'vitest'
import { outputLayout, outputsOnRight, nodeOutputHeight, pruneInvalidEdges } from '@/tatva/workflows/graphMap'

// FIX 2 — where handles render is a function of HOW MANY outputs a node has, never of its node_type.
// A handful spread across the bottom edge; many move to the right edge, one per row, so a ten-disposition
// Route reads instead of cramping twelve handles 20px apart across a 260px strip. The rule lives here, as
// pure data, so it is the same answer the card draws and a test can check — and so a future many-output
// node inherits it without a line of node-type code.
describe('output handle layout — count-keyed, never node-type-keyed', () => {
  it('spreads a handful of handles across the bottom edge', () => {
    expect(outputsOnRight(4)).toBe(false)
    const l = outputLayout(0, 4)
    expect(l.position).toBe('bottom')
    expect(l.style.left).toMatch(/%$/)
  })

  it('moves many handles to the right edge, one per row', () => {
    expect(outputsOnRight(11)).toBe(true)
    const first = outputLayout(0, 11)
    const last = outputLayout(10, 11)
    expect(first.position).toBe('right')
    expect(last.position).toBe('right')
    // vertically distributed — each row sits lower than the one above it
    expect(parseFloat(last.style.top)).toBeGreaterThan(parseFloat(first.style.top))
  })

  it('node height is deterministic from the output count, and tall only when it must be', () => {
    expect(nodeOutputHeight(4)).toBeNull() // a bottom node keeps the default card height
    const h7 = nodeOutputHeight(7)
    const h11 = nodeOutputHeight(11)
    expect(h11).toBeGreaterThan(h7) // more rows → taller
    expect(nodeOutputHeight(11)).toBe(nodeOutputHeight(11)) // same count → same height, by construction
  })
})

// FIX 1's whole reason for id-keying: reordering rows changes the ORDER (first-match logic) but never an
// id, and edges key on the id — so a wired branch follows its row wherever it lands, and nothing is pruned.
describe('reordering route rows never strands a wired edge', () => {
  it('keeps every edge when the outputs are the same ids in a new order', () => {
    const flowNodes = [{ id: 'rt' }]
    const edges = [
      { source: 'rt', sourceHandle: 'a', target: 'X' },
      { source: 'rt', sourceHandle: 'b', target: 'Y' },
    ]
    // The author dragged row b above row a: SAME ids, new order.
    const afterReorder = { rt: ['b', 'a', 'otherwise'] }
    const kept = pruneInvalidEdges(flowNodes, edges, afterReorder)
    expect(kept).toHaveLength(2)
    expect(kept.map((e) => `${e.sourceHandle}->${e.target}`).sort()).toEqual(['a->X', 'b->Y'])
  })
})
