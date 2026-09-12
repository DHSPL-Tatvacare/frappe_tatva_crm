// TATVA: what a SMART VIEW knows about conditions — its operators, and which control edits a value.
//
// The predicate control (`tatva/predicate`) owns structure and nothing else: it has no idea what a
// Smart View field is, which operators the composer can run, or that a date range is picked with two
// calendars. All of that is here, and it is handed in as plain data and one slot, which is what lets the
// same control serve the automation builder and a form builder without learning any of them.
//
// The operators are the composer's own (`smartview/query.py: _OPS`); nothing is offered that the server
// would refuse.
// A fieldtype answers to a KIND, and a kind decides both the operators and the control. One mapping,
// read by both, so an operator can never be offered that its control cannot express.
const TEXT = ['Data', 'Small Text', 'Text', 'Long Text', 'Text Editor', 'Code']
const NUMBER = ['Int', 'Float', 'Currency', 'Percent']
const DATE = ['Date', 'Datetime']
const LINKY = ['Link', 'Dynamic Link']

export function kindOf(fieldtype) {
  if (fieldtype === 'Check') return 'check'
  if (fieldtype === 'Select') return 'select'
  if (fieldtype === 'Duration') return 'duration'
  if (fieldtype === 'Rating') return 'rating'
  if (NUMBER.includes(fieldtype)) return 'number'
  if (DATE.includes(fieldtype)) return 'date'
  if (LINKY.includes(fieldtype)) return 'link'
  if (TEXT.includes(fieldtype)) return 'text'
  return 'text'
}

const OPS = {
  text: ['like', 'not like', '=', '!=', 'is set', 'is not set'],
  number: ['=', '!=', '>', '<', '>=', '<=', 'is set', 'is not set'],
  // `between` first — what the native Filter defaults a date to; omitting it barred authored date ranges.
  date: ['between', 'timespan', '=', '!=', '>', '<', '>=', '<=', 'is set', 'is not set'],
  select: ['=', '!=', 'in', 'not in', 'is set', 'is not set'],
  link: ['=', '!=', 'like', 'is set', 'is not set'],
  check: ['='],
  duration: ['=', '!=', '>', '<', '>=', '<=', 'is set', 'is not set'],
  rating: ['=', '!=', '>', '<', '>=', '<=', 'is set', 'is not set'],
}

const LABELS = {
  '=': __('Equals'),
  '!=': __('Not equals'),
  '>': __('>'),
  '<': __('<'),
  '>=': __('≥'),
  '<=': __('≤'),
  like: __('Like'),
  'not like': __('Not like'),
  'is set': __('Is set'),
  'is not set': __('Is not set'),
  in: __('Is one of'),
  'not in': __('Is none of'),
  between: __('Between'),
  timespan: __('In the'),
}

// { fieldtype -> [{label, value}] }, which is the shape PredicateInput resolves operators by. Keyed by
// the FIELDTYPE the catalog already carries, so nothing has to translate on the way in.
export const operatorsByType = Object.fromEntries(
  [...TEXT, ...NUMBER, ...DATE, ...LINKY, 'Check', 'Select', 'Duration', 'Rating'].map((ft) => [
    ft,
    (OPS[kindOf(ft)] || OPS.text).map((o) => ({ label: LABELS[o] || o, value: o })),
  ]),
)
operatorsByType.default = OPS.text.map((o) => ({ label: LABELS[o] || o, value: o }))

// `range` is EMPTY on purpose. A Smart View date range is one control — DateRangePicker hands back both
// ends as a single value, and `_date_pair` on the server reads it — so there is no second field to fill.
// The two-ended shape exists in the control for hosts that do carry one.
export const shapes = { none: ['is set', 'is not set'], range: [], list: ['in', 'not in'] }

// The control a value is edited with is NOT decided here any more: `tatva/fieldControl.resolveControl` is
// the one place that answers it, for this builder and both filter menus alike. Re-exported so callers of
// this module keep one import.
export { resolveControl } from '@/tatva/fieldControl'
