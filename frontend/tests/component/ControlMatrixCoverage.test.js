import { describe, it, expect } from 'vitest'
import { CONTROLS, GATED, TUPLES, coverage, instancesOf } from './_matrix'
import { CONTRACTS } from './_matrixContracts'

// STEP ONE of the matrix, and deliberately the boring one: prove the coverage number is honest before any
// assertion leans on it. A suite that skips what it does not recognise reports green for the half it read.
describe('the control matrix covers every control the engine declares', () => {
  it('every declared control has a contract', () => {
    const c = coverage(CONTRACTS)
    expect(
      c.missing,
      `no contract for ${c.missing.join(', ')} — write one in _matrixContracts.js or the tuples using it are untested`,
    ).toEqual([])
  })

  it('no contract names a control the engine no longer has', () => {
    const c = coverage(CONTRACTS)
    expect(c.stale, `${c.stale.join(', ')} is contracted but declared by no node — delete it`).toEqual([])
  })

  it('every contract says what it asserts, so a deferred one cannot hide in the count', () => {
    for (const [control, contract] of Object.entries(CONTRACTS)) {
      expect(contract.reason, `${control} has no reason`).toBeTruthy()
      expect(typeof contract.reason).toBe('string')
    }
  })

  // The shape the matrix is built on. If these move, the split of work below moved with them and the plan
  // is stale — which is worth knowing loudly rather than discovering halfway through.
  it('reports the shape it is covering', () => {
    const c = coverage(CONTRACTS)
    expect(c.tuples).toBe(TUPLES.length)
    expect(c.controls).toBe(CONTROLS.length)
    expect(c.gated).toBe(GATED.length)
    expect(c.covered).toBe(c.controls)
  })

  it('no control is declared with zero instances — a contract with nothing to apply to is dead', () => {
    for (const control of CONTROLS) {
      expect(instancesOf(control).length, `${control} has no instances`).toBeGreaterThan(0)
    }
  })
})
