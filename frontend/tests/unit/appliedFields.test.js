import { describe, it, expect, vi } from 'vitest'

// `depends_on_value` had TWO readers on the canvas: the inspector hid a gated field, and the node card
// went on printing its value. So a Wait switched to a pure timer showed no "Waiting on" control and a
// card reading `send-1` — describing a setting the author could not see or change.
//
// The backend asks the same question in `registry._applies`, and `_rows_from` now asks it before reading
// `source_node` at all. One rule, three places it is asked, one reader on this side.

vi.mock('frappe-ui', () => ({
  createResource: () => ({ data: DECLARATIONS, fetched: true }),
}))

const WAIT_FIELDS = [
  { name: 'mode', type: 'Select' },
  { name: 'source_node', type: 'Node', depends_on_value: { mode: ['Until Event', 'Event-or-Timeout'] } },
  { name: 'expression', type: 'Data', depends_on_value: { mode: ['For Duration', 'Until Time'] } },
]
const DECLARATIONS = [{ type: 'Wait', config: WAIT_FIELDS }]

const { useNodeTypes } = await import('@/tatva/useNodeTypes')

describe('appliedFieldsFor — the gate, read once for every consumer', () => {
  it('drops a field whose gate is shut', () => {
    const { appliedFieldsFor } = useNodeTypes()
    const applied = appliedFieldsFor('Wait', { mode: 'For Duration', source_node: 'send-1' })

    expect(applied.map((f) => f.name)).toEqual(['mode', 'expression'])
  })

  it('keeps a field whose gate is open', () => {
    const { appliedFieldsFor } = useNodeTypes()
    const applied = appliedFieldsFor('Wait', { mode: 'Until Event', source_node: 'send-1' })

    expect(applied.map((f) => f.name)).toEqual(['mode', 'source_node'])
  })

  it('keeps an ungated field whatever the config says', () => {
    const { appliedFieldsFor } = useNodeTypes()
    expect(appliedFieldsFor('Wait', {}).map((f) => f.name)).toContain('mode')
  })

  it('does not clear the value it is hiding', () => {
    // Gated on READ. An author flipping mode timer -> event -> timer keeps their wiring, so the config
    // still carries `source_node` and only the ANSWER changes.
    const { appliedFieldsFor } = useNodeTypes()
    const config = { mode: 'For Duration', source_node: 'send-1' }

    appliedFieldsFor('Wait', config)

    expect(config.source_node).toBe('send-1')
  })
})
