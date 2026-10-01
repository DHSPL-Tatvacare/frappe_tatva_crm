import { parseLinkFilters } from '@/utils/fieldTransforms'

describe('parseLinkFilters', () => {
  it('returns null for falsy input', () => {
    expect(parseLinkFilters(null)).toBeNull()
    expect(parseLinkFilters(undefined)).toBeNull()
    expect(parseLinkFilters('')).toBeNull()
    expect(parseLinkFilters(0)).toBeNull()
  })

  it('parses a valid JSON string', () => {
    expect(parseLinkFilters('{"company":"ACME"}')).toEqual({ company: 'ACME' })
  })

  it('returns object as-is if already an object', () => {
    const obj = { company: 'ACME', enabled: 1 }
    expect(parseLinkFilters(obj)).toBe(obj)
  })

  it('returns null for invalid JSON string', () => {
    expect(parseLinkFilters('not json')).toBeNull()
  })

  it('handles array JSON', () => {
    expect(parseLinkFilters('[1,2]')).toEqual([1, 2])
  })

  // TATVA: `eval:` values read the open document, as frappe's link.js parse_filters does.
  const stageFilters = JSON.stringify([
    ['CRM Lead Stage', 'selectable', '=', 1],
    ['CRM Lead Stage', 'program', '=', 'eval:doc.custom_current_program'],
  ])

  it('without a document leaves an eval: value as written', () => {
    expect(parseLinkFilters(stageFilters)).toEqual(JSON.parse(stageFilters))
  })

  it('reads an eval: value off the document', () => {
    expect(
      parseLinkFilters(stageFilters, {
        custom_current_program: 'Inside-Sales',
      }),
    ).toEqual([
      ['CRM Lead Stage', 'selectable', '=', 1],
      ['CRM Lead Stage', 'program', '=', 'Inside-Sales'],
    ])
  })

  it('hands a child row its parent', () => {
    const filters = [
      ['HD Ticket Sub Type', 'ticket_type', '=', 'eval:parent.ticket_type'],
    ]
    expect(
      parseLinkFilters(filters, { name: 'row-1' }, { ticket_type: 'Billing' }),
    ).toEqual([['HD Ticket Sub Type', 'ticket_type', '=', 'Billing']])
  })

  it('leaves a broken expression unresolved instead of breaking the form', () => {
    const filters = [['CRM Lead Stage', 'program', '=', 'eval:doc.(']]
    expect(parseLinkFilters(filters, {})).toEqual(filters)
  })
})
