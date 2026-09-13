// The ONE export dialog: both surfaces get the same wording, and a line shows only where it is true.
import { describe, it, expect } from 'vitest'
import { Select } from 'frappe-ui'
import { mountTatva } from './_mount'
import ExportDialog from '@/tatva/ExportDialog.vue'

const LIMIT = 100000

// The modal shell has its own spec (ResponsiveDialog.test.js); stubbed so the BODY is what gets asserted.
const shellStub = {
  name: 'ResponsiveDialog',
  props: ['modelValue', 'options'],
  template: '<div data-stub="shell"><slot name="body-content" /></div>',
}

const open = (props = {}) =>
  mountTatva(ExportDialog, {
    props: { modelValue: true, total: 4124, rowLimit: LIMIT, ...props },
    global: { stubs: { ResponsiveDialog: shellStub } },
  })

// Off the inner `Select`: `options` falls through `useAttrs`, so FormControl.props('options') is undefined.
const formats = (w) =>
  w.findAllComponents(Select).flatMap((s) => (s.props('options') || []).map((o) => o.label))
const tick = (w) => w.find('input[type="checkbox"]')

describe('ExportDialog — one dialog, and a line only when it is true', () => {
  it('states what the file is, in one sentence, always', () => {
    expect(open().text()).toContain(
      'Exports this view as it is — same columns, same filters, same order.',
    )
  })

  it('offers Excel and CSV — never a format name a rep has to decode', () => {
    expect(formats(open())).toEqual(['Excel', 'CSV'])
  })

  it('says nothing about a ceiling nobody is near', () => {
    expect(open({ total: 4124 }).text()).not.toContain('Restricted to')
  })

  it('stays silent about the ceiling until ALL is asked for, however many matched', () => {
    // Unticked, the file is the rows on screen — a ceiling on everything cannot bite it.
    expect(open({ total: 173402 }).text()).not.toContain('Restricted to')
  })

  it('states the ceiling, once, when ALL is asked for and the count exceeds it', async () => {
    const w = open({ total: 173402 })
    await tick(w).setValue(true)
    expect(w.text()).toContain('Restricted to the first 100,000 rows.')
  })

  it('names derived fields only on a view that actually shows one', () => {
    expect(open({ hasDerived: false }).text()).not.toContain(
      'Derived fields are not included.',
    )
    expect(open({ hasDerived: true }).text()).toContain(
      'Derived fields are not included.',
    )
  })

  it('counts in the reader’s own notation, not raw digits', () => {
    expect(open({ total: 173402 }).text()).toContain('173,402')
  })

  it('opens the same way every time — a tick does not survive being closed', async () => {
    const w = open()
    await tick(w).setValue(true)
    expect(tick(w).element.checked).toBe(true)
    await w.setProps({ modelValue: false })
    await w.setProps({ modelValue: true })
    expect(tick(w).element.checked).toBe(false)
  })
})
