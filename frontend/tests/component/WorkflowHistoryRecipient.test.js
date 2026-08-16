// W12 — the run history says WHO the engine reached, READ FROM THE STEP LOG and never re-derived from
// the lead: a lead's number changes, and the log is the record of the number actually used. The second
// test is that rule as an assertion — a re-derived implementation cannot pass it.
// Mocked at the network boundary (frappe-ui's own convention) so the real createResource path runs.
import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'
import WorkflowRunModal from '@/tatva/workflows/WorkflowRunModal.vue'

// The test subscriber this codebase already documents, in the STORE form the step log holds.
const REACHED = '+919876543210'

function journey(overrides = {}) {
  return {
    journey: 'jrn-1',
    workflow: 'Onboarding',
    status: 'Done',
    current_node: 'n2',
    stop_reason: null,
    started: '2026-08-01 09:00:00',
    stuck: false,
    ...overrides,
  }
}

function step(overrides = {}) {
  return {
    name: 's1',
    node_id: 'n1',
    node_type: 'Send WhatsApp',
    outcome: 'sent',
    channel: 'whatsapp',
    contact: REACHED,
    detail: '',
    duration_ms: 12,
    creation: '2026-08-01 09:00:01',
    ...overrides,
  }
}

// The shared overlay stub renders `#body`; this modal writes into `#body-title` and `#body-content`.
const DialogStub = {
  name: 'ResponsiveDialogStub',
  template:
    '<div data-stub="ResponsiveDialog"><slot name="body-title" /><slot name="body-content" /></div>',
}

// The modal is the only thing that reads a step, so it is this rule's subject; it is handed the journey summary the list already holds and fetches the steps itself.
async function open(steps, row = journey()) {
  mockFrappeMethod('tatva_connect.workflow_engine.history.journey_steps', { steps, has_more: false })
  const w = mountTatva(WorkflowRunModal, {
    props: { modelValue: true, journey: row },
    global: { stubs: { ResponsiveDialog: DialogStub } },
  })
  await flushPromises()
  return w
}

describe('WorkflowRunModal — who was reached, read from the log', () => {
  it('shows the number the step really used', async () => {
    expect((await open([step()])).text()).toContain(REACHED)
  })

  it('shows the number FROM THE STEP, not any current value of the lead', async () => {
    const w = await open([step({ contact: '+919876543299' })])
    expect(w.text()).toContain('+919876543299')
    expect(w.text()).not.toContain(REACHED)
  })

  it('names the channel that reached them, so voice and WhatsApp are told apart', async () => {
    const w = await open([step({ channel: 'voice', node_type: 'Send Voice' })])
    expect(w.text().toLowerCase()).toContain('voice')
  })

  it('a step that contacted nobody shows no recipient at all', async () => {
    const w = await open([step({ node_type: 'Branch', outcome: 'ok', channel: '', contact: '' })])
    expect(w.text()).not.toContain('null')
    expect(w.text()).not.toContain('undefined')
    expect(w.text()).not.toContain(REACHED)
  })

  it('a stopped journey says why it ended, not where it was standing when it died', async () => {
    const w = await open([step()], journey({ status: 'Stopped', stop_reason: 'Workflow archived (Onboarding)' }))
    expect(w.text()).toContain('Workflow archived (Onboarding)')
    expect(w.text()).not.toContain('Currently at')
  })
})
