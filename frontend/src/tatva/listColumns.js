// TATVA: the ONE typed-column rule every in-house ListView reads — width, cell format, pill treatment.
// Lived twice (SmartViewList and the section rows modal) and the two drifted the moment one was edited;
// a column of the same fieldtype must look identical wherever it is drawn.
import { formatDate } from '@/utils'

// Width by real fieldtype — dates narrow, numbers narrow, text wider. Keeps the grid honest instead of
// a flat 12rem everywhere.
const WIDTHS = {
  Int: '7rem',
  Float: '8rem',
  Currency: '9rem',
  Percent: '7rem',
  Rating: '8rem',
  Check: '6rem',
  Date: '9rem',
  Datetime: '11rem',
  Time: '8rem',
  Select: '14rem',
  Link: '14rem',
  'Dynamic Link': '14rem',
  'Small Text': '16rem',
  Text: '16rem',
  'Long Text': '18rem',
  'Text Editor': '18rem',
}

// The first column carries the row's identity, so an untyped/Data/Link one gets a touch more room.
export function widthFor(fieldtype, isFirst) {
  if (
    isFirst &&
    ['Data', 'Link', 'Dynamic Link', undefined].includes(fieldtype)
  )
    return '15rem'
  return WIDTHS[fieldtype] || '12rem'
}

// Native cell formatting: dates via formatDate (a raw ISO string is the "dirty" look), Check as a tick.
export function formatCell(value, fieldtype) {
  if (value === null || value === undefined || value === '') return ''
  // A multi-value field's cell is the list of labels the server already resolved — read as one line.
  if (Array.isArray(value)) return value.join(', ')
  if (fieldtype === 'Date') return formatDate(value, 'D MMM YYYY', true)
  if (fieldtype === 'Datetime') return formatDate(value, 'D MMM YYYY, h:mm a')
  if (fieldtype === 'Check') return value ? '✓' : ''
  return value
}

// Select (and status-like Link) read as a subtle pill, like the native lists.
export function isPill(column) {
  return column.type === 'Select' || column.type === 'Link'
}

// frappe-ui Badge's own themes, minus red — red reads as a failure and these values carry no verdict (G5).
const PILL_THEMES = ['gray', 'blue', 'green', 'orange']

// The SAME value always gets the SAME theme, in every view and session — derived from the text, never row order.
export function pillTheme(value) {
  const s = String(value ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PILL_THEMES[h % PILL_THEMES.length]
}

// A measurement reads right-aligned, text reads left — the same rule the native column picker applies
// to a column you add by hand (ColumnSettings.addColumn), so a default and an added column agree.
const NUMERIC = ['Float', 'Int', 'Percent', 'Currency', 'Duration']
export function alignFor(fieldtype) {
  return NUMERIC.includes(fieldtype) ? 'right' : 'left'
}
