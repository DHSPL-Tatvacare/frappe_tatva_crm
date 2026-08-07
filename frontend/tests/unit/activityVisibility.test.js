// The client half of the activity form's ONE settle. `settleVisible` mirrors `_settled` in
// tatva_connect/activity/api.py: it answers WHICH fields are on screen AND hands back the inert bag
// (D22 — every hidden field read back blank). `requiredHere` mirrors `_required_here`, which asks that
// same bag. If these drift, the rep is shown a demand the server does not make, or none where it does.
import {
  copiedValues,
  settleVisible,
  withBlanks,
  requiredHere,
} from '@/tatva/activityVisibility'

const field = (fieldname, extra = {}) => ({
  fieldname,
  label: fieldname,
  reqd: 0,
  depends_on: '',
  mandatory_depends_on: '',
  container_depends_on: [],
  copy_from: [],
  ...extra,
})

const layoutOf = (fields) => [
  { key: 'tab', sections: [{ key: 'sec', columns: [{ key: 'col', fields }] }] },
]

const settle = (fields, values) =>
  settleVisible(layoutOf(fields), fields, withBlanks(fields, values))

describe('settleVisible returns the inert bag', () => {
  const fields = [
    field('outcome'),
    field('reason', { depends_on: 'eval:doc.outcome=="Failed"' }),
  ]

  it('reads a hidden field back blank while a shown one keeps its answer', () => {
    const settled = settle(fields, { outcome: 'Done', reason: 'stale' })
    expect(settled.fields.has('reason')).toBe(false)
    expect(settled.live.outcome).toBe('Done')
    expect(settled.live.reason).toBe('')
  })

  it('keeps the answer once the field is on screen', () => {
    const settled = settle(fields, { outcome: 'Failed', reason: 'stale' })
    expect(settled.fields.has('reason')).toBe(true)
    expect(settled.live.reason).toBe('stale')
  })
})

describe('requiredHere', () => {
  it('demands a field a Make Mandatory rule names, only while its condition holds', () => {
    const fields = [
      field('outcome'),
      field('reason', { mandatory_depends_on: 'eval:doc.outcome=="Failed"' }),
    ]
    const reason = fields[1]
    expect(requiredHere(reason, settle(fields, { outcome: 'Failed' }))).toBe(
      true,
    )
    expect(requiredHere(reason, settle(fields, { outcome: 'Done' }))).toBe(
      false,
    )
  })

  it('never demands a hidden field, whatever its rule says', () => {
    const fields = [
      field('outcome'),
      field('reason', {
        depends_on: 'eval:doc.outcome=="Failed"',
        mandatory_depends_on: 'eval:1',
        reqd: 1,
      }),
    ]
    expect(requiredHere(fields[1], settle(fields, { outcome: 'Done' }))).toBe(
      false,
    )
    expect(requiredHere(fields[1], settle(fields, { outcome: 'Failed' }))).toBe(
      true,
    )
  })

  it('judges a rule against the INERT bag, not the raw answers (D22)', () => {
    // `reason` is mandated by an answer to `escalate`, which its own condition has taken off screen.
    const fields = [
      field('outcome'),
      field('escalate', { depends_on: 'eval:doc.outcome=="Failed"' }),
      field('reason', { mandatory_depends_on: 'eval:doc.escalate=="Yes"' }),
    ]
    const settled = settle(fields, { outcome: 'Done', escalate: 'Yes' })
    expect(settled.fields.has('escalate')).toBe(false)
    expect(requiredHere(fields[2], settled)).toBe(false)
  })

  it('still honours a statically declared reqd with no rule', () => {
    const fields = [field('outcome', { reqd: 1 })]
    expect(requiredHere(fields[0], settle(fields, {}))).toBe(true)
  })

  it('demands nothing when neither reqd nor a rule names the field', () => {
    const fields = [field('outcome')]
    expect(requiredHere(fields[0], settle(fields, {}))).toBe(false)
  })
})

// Mirrors `copied_values` in tatva_connect/activity/api.py. The server recomputes the copy at save and
// discards whatever the browser sent, so a drift here shows the rep a blank the saved record will not hold.
describe('copiedValues', () => {
  const twoCopies = () => [
    field('outcome'),
    field('source_a'),
    field('source_b'),
    field('target', {
      copy_from: [
        { source: 'source_a', when: 'eval:doc.outcome=="A"' },
        { source: 'source_b', when: 'eval:doc.outcome=="B"' },
      ],
    }),
  ]

  it('copies from the rule that FIRES, not from the first one declared', () => {
    const fields = twoCopies()
    const values = { outcome: 'B', source_a: 'from a', source_b: 'from b' }
    expect(copiedValues(fields, settle(fields, values)).target).toBe('from b')
  })

  it('copies nothing when no rule fires, so the field keeps what it held', () => {
    const fields = twoCopies()
    const settled = settle(fields, { outcome: 'C', source_a: 'from a' })
    expect(copiedValues(fields, settled)).toEqual({})
  })

  it('reads the source from the INERT bag, so a hidden source copies blank (D22)', () => {
    const fields = [
      field('outcome'),
      field('source_a', { depends_on: 'eval:doc.outcome=="A"' }),
      field('target', {
        copy_from: [{ source: 'source_a', when: 'eval:1' }],
      }),
    ]
    const settled = settle(fields, { outcome: 'C', source_a: 'off screen' })
    expect(settled.fields.has('source_a')).toBe(false)
    expect(copiedValues(fields, settled).target).toBe('')
  })

  it('does not copy into a field the form is not showing', () => {
    const fields = [
      field('outcome'),
      field('source_a'),
      field('target', {
        depends_on: 'eval:doc.outcome=="A"',
        copy_from: [{ source: 'source_a', when: 'eval:1' }],
      }),
    ]
    const settled = settle(fields, { outcome: 'C', source_a: 'value' })
    expect(copiedValues(fields, settled)).toEqual({})
  })
})
