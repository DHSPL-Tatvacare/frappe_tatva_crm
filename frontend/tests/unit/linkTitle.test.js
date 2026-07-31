// Purpose: ONE reader answers every list cell that holds a foreign key. A Link's target doctype is
// `column.options`; a Dynamic Link's `options` is a FIELDNAME and the target is on the ROW. Reading the
// fieldname as a doctype is exactly the trap that grew a private `_link_titles` copy inside Notes.vue —
// so Tasks and Call Logs showed `CRM-LEAD-2026-00123` while the patient's name was already on the wire.
import { describe, expect, it, vi } from 'vitest'

// linkTitle.js also holds `ensureLinkTitle`, which imports frappe-ui's `call`. This spec never fetches;
// stubbing the module keeps the pure lookups under test from dragging in the whole client.
vi.mock('frappe-ui', () => ({ call: vi.fn() }))

const { linkTitle, linkTitleFor, linkTargetDoctype } = await import(
  '../../src/tatva/linkTitle.js'
)

// The shape `get_data` ships: a flat map keyed `{doctype}::{pk}`.
const list = {
  data: {
    _link_titles: {
      'CRM Lead::CRM-LEAD-2026-00123': 'Anaya Sharma',
      'CRM Deal::CRM-DEAL-2026-00007': 'Sharma Renewal',
      'CRM Task Type::GF::G1::P1::Welcome Call': 'Welcome Call',
    },
  },
}

const leadColumn = {
  label: 'Lead',
  type: 'Dynamic Link',
  key: 'reference_docname',
  options: 'reference_doctype',
}

describe('linkTitle on a Dynamic Link column', () => {
  it("resolves the target doctype from the ROW, not from column.options", () => {
    const row = {
      reference_doctype: 'CRM Lead',
      reference_docname: 'CRM-LEAD-2026-00123',
    }
    expect(linkTitle('CRM-LEAD-2026-00123', leadColumn, list, row)).toBe(
      'Anaya Sharma',
    )
  })

  it('follows the row to a different target on the same column', () => {
    const row = {
      reference_doctype: 'CRM Deal',
      reference_docname: 'CRM-DEAL-2026-00007',
    }
    expect(linkTitle('CRM-DEAL-2026-00007', leadColumn, list, row)).toBe(
      'Sharma Renewal',
    )
  })

  it('declines when no row is given — a fieldname is never a doctype', () => {
    expect(linkTitle('CRM-LEAD-2026-00123', leadColumn, list)).toBeNull()
  })

  it('declines when the row carries no target doctype', () => {
    expect(
      linkTitle('CRM-LEAD-2026-00123', leadColumn, list, { name: 'x' }),
    ).toBeNull()
  })

  it('returns null for a value the map does not carry, so the raw key stands', () => {
    const row = { reference_doctype: 'CRM Lead' }
    expect(linkTitle('CRM-LEAD-9999', leadColumn, list, row)).toBeNull()
  })
})

describe('linkTitle on a plain Link column is unchanged', () => {
  const typeColumn = {
    type: 'Link',
    key: 'custom_task_type',
    options: 'CRM Task Type',
  }

  it('still resolves a composite grain PK from column.options', () => {
    expect(linkTitle('GF::G1::P1::Welcome Call', typeColumn, list)).toBe(
      'Welcome Call',
    )
  })

  it('declines a column with no options, and a blank value', () => {
    expect(linkTitle('anything', { type: 'Link' }, list)).toBeNull()
    expect(linkTitle('', typeColumn, list)).toBeNull()
  })

  it('declines a non-link column type', () => {
    expect(linkTitle('Todo', { type: 'Select', key: 'status' }, list)).toBeNull()
  })
})

describe('linkTargetDoctype is the one resolver both readers share', () => {
  it('reads a Dynamic Link off the row and a Link off the column', () => {
    expect(
      linkTargetDoctype(leadColumn, { reference_doctype: 'CRM Lead' }),
    ).toBe('CRM Lead')
    expect(linkTargetDoctype({ type: 'Link', options: 'User' }, {})).toBe('User')
    expect(linkTargetDoctype({ type: 'Data' }, {})).toBeNull()
  })
})

describe('linkTitleFor stays the single map lookup', () => {
  it('answers from the doctype and pk it is handed', () => {
    expect(linkTitleFor('CRM Lead', 'CRM-LEAD-2026-00123', list)).toBe(
      'Anaya Sharma',
    )
    expect(linkTitleFor(null, 'CRM-LEAD-2026-00123', list)).toBeNull()
  })
})
