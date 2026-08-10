// The slice the canvas hands the inspector. `test_one_context_answer.py` owns the equivalence with the
// backend; this owns the two things only the client can get wrong — reading the wrong node, and rendering
// a node the answer has not reached yet as if it were configured.
import { describe, it, expect } from 'vitest'
import { contextFor } from '@/tatva/workflows/nodeContext'

const SUBJECT = [
  { ref: 'crm_lead.status', label: 'Status', type: 'Link', emitted: false },
  { ref: 'crm_lead.mobile_no', label: 'Mobile No', type: 'Data', emitted: false },
]

const ANSWER = {
  subject: 'CRM Lead',
  grain: { vertical: 'Tatvapractice' },
  working_set: ['status'],
  subject_fields: SUBJECT,
  settable: [{ key: 'status' }],
  operators_by_type: { Data: ['is'] },
  operator_shapes: { is: 'value' },
  nodes: {
    'call-api-1': { emitted: [], emitters: [] },
    'send-1': {
      emitted: [{ ref: 'call-api-1.phone', label: 'phone', emitted: true }],
      emitters: [{ node_id: 'call-api-1', outcomes: ['succeeded'] }],
    },
  },
}

describe('contextFor — one node’s slice of the graph answer', () => {
  it('puts the halves back in the order the backend does, emitted first', () => {
    expect(contextFor(ANSWER, 'send-1').variables.map((v) => v.ref)).toEqual([
      'call-api-1.phone',
      'crm_lead.status',
      'crm_lead.mobile_no',
    ])
  })

  it('gives every node the same graph half, and only its own positional half', () => {
    const send = contextFor(ANSWER, 'send-1')
    const call = contextFor(ANSWER, 'call-api-1')
    expect(call.settable).toBe(send.settable)
    expect(call.grain).toBe(send.grain)
    expect(call.variables.map((v) => v.ref)).toEqual(['crm_lead.status', 'crm_lead.mobile_no'])
    expect(call.emitters).toEqual([])
    expect(send.emitters).toHaveLength(1)
  })

  it('carries the whole contract through, not just the values', () => {
    const slice = contextFor(ANSWER, 'send-1')
    expect(slice.subject).toBe('CRM Lead')
    expect(slice.working_set).toEqual(['status'])
    expect(slice.operators_by_type).toEqual({ Data: ['is'] })
    expect(slice.operator_shapes).toEqual({ is: 'value' })
  })

  it('answers nothing for a node the graph answer does not hold, so the panel waits instead of lying', () => {
    expect(contextFor(ANSWER, 'just-dropped-1')).toBeNull()
    expect(contextFor(null, 'send-1')).toBeNull()
    expect(contextFor(undefined, 'send-1')).toBeNull()
  })
})
