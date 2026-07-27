import { describe, it, expect, vi } from 'vitest'

// PredicateBuilder is a separate contract (its own suite); stub it so this is only about the row control's
// ergonomics — a drag handle per row, and an id that is generated on ADD and never re-keyed after.
vi.mock('@/tatva/PredicateBuilder.vue', () => ({
  default: { name: 'PredicateBuilder', template: '<div class="pb-stub" />' },
}))

import { mountTatva } from './_mount'
import RouteRows from '@/tatva/workflows/RouteRows.vue'

const ROWS = [
  { id: 'a', label: 'New', condition: null },
  { id: 'b', label: 'Won', condition: null },
]

describe('RouteRows — order is the logic, so rows drag; ids are stable so wiring survives', () => {
  it('renders a drag handle for every row', () => {
    const w = mountTatva(RouteRows, { props: { modelValue: ROWS } })
    expect(w.findAll('.route-drag')).toHaveLength(2)
  })

  it('adds a row with a fresh id and leaves the existing ids untouched', async () => {
    const w = mountTatva(RouteRows, { props: { modelValue: [{ id: 'a', label: 'New', condition: null }] } })
    const add = w.findAll('button').find((b) => b.text().includes('Add route'))
    await add.trigger('click')

    const emitted = w.emitted('update:modelValue').at(-1)[0]
    expect(emitted).toHaveLength(2)
    expect(emitted[0].id).toBe('a') // the existing row keeps its id — the edge wired to it is not stranded
    expect(emitted[1].id).toBeTruthy()
    expect(emitted[1].id).not.toBe('a') // the new row gets its own stable id
  })

  it('removing a row keeps the OTHER rows ids intact', async () => {
    const w = mountTatva(RouteRows, { props: { modelValue: ROWS } })
    const remove = w.findAll('button').find((b) => b.attributes('aria-label') === 'Remove' || b.html().includes('Remove'))
    await remove.trigger('click')

    const emitted = w.emitted('update:modelValue').at(-1)[0]
    expect(emitted.map((r) => r.id)).toEqual(['b']) // row a removed, b keeps its id
  })
})
