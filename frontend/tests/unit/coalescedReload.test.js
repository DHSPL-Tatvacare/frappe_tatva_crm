import { describe, it, expect } from 'vitest'
import { coalescedReload } from '@/tatva/coalescedReload.js'

function deferredResource() {
  const calls = []
  return {
    calls,
    reload() {
      let resolve
      const promise = new Promise((r) => (resolve = r))
      calls.push(resolve)
      return promise
    },
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('coalescedReload', () => {
  it('collapses a burst of events into one follow-up reload', async () => {
    const thread = deferredResource()
    const reasons = deferredResource()
    const reload = coalescedReload(thread, reasons)

    for (let i = 0; i < 50; i++) reload()
    expect(thread.calls.length).toBe(1)
    expect(reasons.calls.length).toBe(1)

    thread.calls[0]()
    reasons.calls[0]()
    await settle()
    expect(thread.calls.length).toBe(2)

    thread.calls[1]()
    reasons.calls[1]()
    await settle()
    expect(thread.calls.length).toBe(2)
  })

  it('reloads again for an event that lands after the previous reload finished', async () => {
    const thread = deferredResource()
    const reload = coalescedReload(thread)
    reload()
    thread.calls[0]()
    await settle()
    reload()
    expect(thread.calls.length).toBe(2)
  })

  it('a failed reload does not wedge the next one', async () => {
    let calls = 0
    const failing = { reload: () => (calls++, Promise.reject(new Error('boom'))) }
    const reload = coalescedReload(failing)
    reload()
    await settle()
    reload()
    expect(calls).toBe(2)
  })
})
