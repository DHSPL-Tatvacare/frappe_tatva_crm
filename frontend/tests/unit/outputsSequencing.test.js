import { describe, it, expect } from 'vitest'
import { latestOnly, pruneInvalidEdges } from '@/tatva/workflows/graphMap'

// THE RACE. Two resolves of `graph_outputs` are routinely in flight at once — the graph watcher fires on
// every edit, and `pruneEdges` issues its own on a shape change. They land by ARRIVAL, not by issue
// order, and both write the same shared ref.
//
// That ref is what `pruneInvalidEdges` DELETES from. So an older answer arriving last does not merely
// show stale handles for a moment: it removes branches that are perfectly valid, from the author's
// canvas, with no error and nothing to undo it.

// A fetch that lands after `delay` ms, standing in for the round trip.
function landsAfter(answer, delay) {
  return new Promise((resolve) => setTimeout(() => resolve(answer), delay))
}

function node(id, node_type) {
  return { id, data: { node: { node_id: id, node_type, config_json: '{}' } } }
}

function edge(source, sourceHandle) {
  return { id: `${source}-${sourceHandle}`, source, sourceHandle, target: 'end' }
}

describe('latestOnly — an older answer may never replace a newer one', () => {
  it('hands a superseded caller the WINNER answer, never its own and never a cached one', async () => {
    // Returning null made WorkflowCanvas substitute the previous answer, which deleted valid branches.
    const resolve = latestOnly((answer, delay) => landsAfter(answer, delay))

    const stale = resolve({ 'w1': ['event'] }, 40) // issued FIRST, lands LAST
    const fresh = resolve({ 'w1': ['yes', 'no'] }, 5) // issued SECOND, lands FIRST

    expect(await fresh).toEqual({ 'w1': ['yes', 'no'] })
    expect(await stale).toEqual({ 'w1': ['yes', 'no'] })
  })

  it('the newest answer is returned normally when nothing supersedes it', async () => {
    // The other direction, or a blanket "return the winner" would pass the test above by accident.
    const resolve = latestOnly((answer) => landsAfter(answer, 1))
    expect(await resolve({ 'w1': ['event'] })).toEqual({ 'w1': ['event'] })
  })

  it('a stale answer landing last does not delete the author button branches', async () => {
    // The consequence: a resolve for the OLDER graph is still in flight and lands after the newer one.
    const resolve = latestOnly((answer, delay) => landsAfter(answer, delay))
    const nodes = [node('wa', 'Send WhatsApp'), node('w1', 'Wait'), node('end', 'Terminal')]
    const edges = [edge('w1', 'yes'), edge('w1', 'no')]

    let outputs = {}
    const apply = async (answer, delay) => {
      const landed = await resolve(answer, delay)
      if (landed) outputs = landed
    }

    const stalePass = apply({ wa: ['sent', 'failed'], w1: ['event'], end: [] }, 40)
    const freshPass = apply({ wa: ['sent', 'failed'], w1: ['yes', 'no'], end: [] }, 5)
    await Promise.all([freshPass, stalePass])

    expect(pruneInvalidEdges(nodes, edges, outputs)).toHaveLength(2)
  })
})
