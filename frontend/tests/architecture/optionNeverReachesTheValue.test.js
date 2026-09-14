// A control that MODELS AN OPTION must never have its emit stored as the value.
//
// frappe-ui's Autocomplete emits `{label, value}`, not a bare value (its own types.ts). Every consumer of
// `tatva/fieldControl.resolveControl` therefore has to undress what it gets back. Two of the three did;
// the Smart View editor did not, so a condition on any Select field stored the whole option object, it
// reached SQL as `{'label': 'Warm', ...}`, and the view answered 500. Found by clicking, not by a test.
//
// This locks the rule rather than the instance: ask the ONE resolver, store a plain value.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src')
const read = (p) => readFileSync(resolve(SRC, p), 'utf8')

// Every file that asks `resolveControl` what to render, and therefore receives an option back.
const CONSUMERS = [
  'components/Filter.vue',
  'components/QuickFilterField.vue',
  'tatva/SmartViewEditor.vue',
]

describe('an option never reaches the stored value', () => {
  for (const file of CONSUMERS) {
    it(`${file} undresses what the control emits`, () => {
      const src = read(file)
      expect(src, 'consumer no longer asks the one resolver — this test needs rewriting').toMatch(/resolveControl/)
      expect(src).toMatch(/fromOption/)
    })

    it(`${file} keeps no private copy of the dress/undress rule`, () => {
      // The pair lives in `tatva/fieldControl`. A local re-implementation is how the three drifted apart.
      expect(read(file)).not.toMatch(/typeof\s+\w+\s*===\s*'object'\s*&&\s*'value'\s+in\s+/)
    })
  }

  it('the Smart View editor hands the predicate a plain value, never the option it was given', () => {
    // The exact regression: `patch({ value: v })` with the Autocomplete's `{label, value}` still on it.
    expect(read('tatva/SmartViewEditor.vue')).not.toMatch(/patch\(\{\s*value:\s*v\s*\}\)/)
  })

  it('fromOption reduces an option, a bare value and a list the same way', async () => {
    const { toOption, fromOption } = await import('@/tatva/fieldControl')
    expect(fromOption({ label: 'Warm', value: 'Warm' })).toBe('Warm')
    expect(fromOption('Warm')).toBe('Warm')
    expect(fromOption(null)).toBe(null)
    expect([{ label: 'A', value: 'a' }, 'b'].map(fromOption)).toEqual(['a', 'b'])
    expect(toOption('', [])).toBe(null)
    expect(toOption('a', [{ label: 'A', value: 'a' }])).toEqual({ label: 'A', value: 'a' })
  })

  it('the pair is declared exactly once, in the resolver that decides the control', () => {
    const owner = read('tatva/fieldControl.js')
    expect(owner).toMatch(/export function toOption/)
    expect(owner).toMatch(/export function fromOption/)
  })
})
