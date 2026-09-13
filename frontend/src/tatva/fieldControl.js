// TATVA: THE one place that decides which control edits a field's value. One change site, every surface.
//
// Before this, the filter panel (Filter.vue) and the quick filter bar (QuickFilterField.vue) each held
// their own if-this-then-that chain, and the Smart View builder a third. Every fix had to be made two or
// three times, or made once and forgotten in the others — which is why a grain axis is a plain dropdown
// in one place and "is one of" degrades to a free-text box in another.
//
// IT BRANCHES ON TWO THINGS, NEVER ON A FIELDNAME:
//
//   1. WHERE THE VALUES COME FROM — an inline list the server already handed us (`options`, or the
//      grain-scoped `grain_options`, which is the same idea), a source you SEARCH (a Link and its
//      server-named query), or free input. A grain axis is therefore not a special case any more: it is
//      "inline list, supplied by the server".
//
//   2. HOW MANY YOU MAY PICK — read off the OPERATOR, never the field. `is set` takes none, `is` takes
//      one, `is one of` takes many, `between` takes two. This is the axis both chains were missing: they
//      assumed one value because they assumed the operator was `=`, which is why a dropdown field turned
//      into a typing box the moment anyone chose "is one of".
//
// It returns a DESCRIPTION — `{ is, props, arity }` — not a rendered node, because each caller binds its
// own model and change handler. Nothing here knows about smart views, quick filters or the filter panel.
import { FormControl, DatePicker, DateTimePicker, DateRangePicker } from 'frappe-ui'
// The app's OWN Autocomplete — the one every link control and form field already uses. It holds several
// values, lays out its own rows and says when it opens; frappe-ui's does only the first of those.
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import Link from '@/components/Controls/Link.vue'
import DurationInput from '@/components/Controls/DurationInput.vue'
import RatingInput from '@/components/Controls/RatingInput.vue'
import { timespanOptions } from '@/utils/timespanOptions'

const TEXT = ['Data', 'Small Text', 'Text', 'Long Text', 'Text Editor', 'Code']
const NUMBER = ['Int', 'Float', 'Currency', 'Percent']
const DATE = ['Date', 'Datetime']
const LINKY = ['Link', 'Dynamic Link']
const INLINE = ['Select', 'Autocomplete']

// ---- axis 2: how many values ------------------------------------------------------------------------
const NO_VALUE = ['is set', 'is not set', 'is empty', 'is not empty']
const MANY = ['in', 'not in']
const RANGE = ['between']

// A field that would OFFER its values is matched exactly; free input is matched as a wildcard search.
// Upstream's rule, unchanged — stated once here because both the writing and the reading of a bar filter
// need it, and a second copy is how the two came to disagree.
const EXACT = ['Check', 'Select', 'Autocomplete', 'Link', 'Date', 'Datetime']
export function matchesExactly(field) {
  return EXACT.includes(field?.fieldtype)
}

// The operator a bar with NO operator picker should use for a field. A bar still HAS an operator — it just
// never shows one — and which one is a property of the FIELD, so it is answered here beside every other
// field-type question rather than by a second list of types in the bar.
//
//   a moment in time  -> a named range (`today`, `last week`), resolved by frappe's own
//                        `get_timespan_date_range`. `=` on a timestamp asks for that exact SECOND.
//   values on offer   -> "is one of", so several may be picked from the first click.
//   anything else     -> equals.
//
// A caller that DOES show an operator picker ignores this and passes the author's choice.
export function defaultOperator(field) {
  if (DATE.includes(field?.fieldtype)) return 'timespan'
  return valuesOf(field).kind === 'free' ? '=' : 'in'
}

const unwrap = (v) => String(v ?? '').replace(/%/g, '')

// What the bar's control HOLDS for a filter as stored — the inverse of writing one, and the same decision,
// which is why it lives beside the one that writes it. The bar shows no operator, so reading a filter back
// is a judgement and not a lookup; it used to be made in the bar from the value's SHAPE plus a private copy
// of the list above, which is exactly how the bar came to write a named date range and read back nothing.
//
// A filter the control cannot express — a wildcard search on a dropdown, a two-ended range on a
// single picker, a filter the panel wrote with an operator the bar does not use — reads back as EMPTY.
// Blank is honest; half-showing a filter the control cannot edit is not.
export function valueFromFilter(field, stored) {
  const arity = arityOf(field?.match === 'contains' ? '=' : defaultOperator(field))
  const blank = arity === 'many' ? [] : field?.fieldtype === 'Check' ? false : ''
  if (stored === undefined || stored === null) return blank
  if (!Array.isArray(stored)) return typeof stored === 'boolean' ? stored : unwrap(stored)
  const op = String(stored[0] ?? '').toLowerCase()
  const value = stored[1]
  // A column holding several values is searched, never equalled — the server says which, and it is the
  // one thing about a bar filter the field's own type cannot answer.
  if (field?.match === 'contains') return op === 'like' ? unwrap(value) : blank
  if (arityOf(op) !== arity) return blank
  if (op === 'like' || op === 'not like') return matchesExactly(field) ? blank : unwrap(value)
  return arity === 'many' ? (Array.isArray(value) ? value : [value]) : (value ?? blank)
}

export function arityOf(operator) {
  if (!operator) return 'one'
  const op = String(operator).toLowerCase()
  if (NO_VALUE.includes(op)) return 'none'
  if (MANY.includes(op)) return 'many'
  if (RANGE.includes(op)) return 'range'
  return 'one'
}


// A field's option list arrives in three shapes depending on who described it: a newline-delimited
// string (a DocField), a list of plain values (a grain axis), or a list of {label,value} the server
// already shaped. Normalising here is the difference between a working picker and one option reading
// "[object Object],[object Object]" — which is what `String(options).split('\n')` does to an array.
function normaliseOptions(options) {
  if (!options) return []
  const list = Array.isArray(options) ? options : String(options).split('\n')
  return list
    .map((o) => (o && typeof o === 'object' ? o : { label: String(o).trim(), value: o }))
    .filter((o) => o.label !== '' && o.value !== undefined && o.value !== null)
}

// ---- axis 1: where the values come from ---------------------------------------------------------------
// `grain_options` is the server's scoped answer for a grain axis — the values on records this caller can
// actually see. It is an inline list like any other, and treating it as one is what stops it needing its
// own branch in every consumer.
export function valuesOf(field) {
  const ft = field?.fieldtype
  if (Array.isArray(field?.grain_options)) {
    return { kind: 'inline', options: normaliseOptions(field.grain_options) }
  }
  if (ft === 'Check') {
    return { kind: 'inline', options: [{ label: __('Yes'), value: 1 }, { label: __('No'), value: 0 }] }
  }
  if (INLINE.includes(ft)) {
    const options = normaliseOptions(field?.options)
    // A Select DECLARED WITH NO OPTIONS renders an empty menu — a dead end, strictly worse than a text
    // box, because the condition cannot be expressed at all. Twelve such fields exist in the live catalog.
    // Render honestly what the declaration supports; options are operator data and code does not invent
    // them. Once they are declared, this falls back to the list on its own.
    return options.length ? { kind: 'inline', options } : { kind: 'free' }
  }
  // A Dynamic Link has no fixed target to search, so there is nothing to offer.
  if (ft === 'Link' && field?.options) {
    return { kind: 'search', doctype: field.options, query: field.link_query || null }
  }
  return { kind: 'free' }
}

// ---- the one lookup ----------------------------------------------------------------------------------
export function resolveControl(field, operator) {
  const ft = field?.fieldtype
  const arity = arityOf(operator)
  if (arity === 'none') return { is: null, props: {}, arity }

  // `is` asks about presence, so its values come from the OPERATOR and never from the field.
  if (String(operator).toLowerCase() === 'is') {
    return {
      is: FormControl,
      props: {
        type: 'select',
        options: [{ label: __('Set'), value: 'set' }, { label: __('Not Set'), value: 'not set' }],
      },
      arity: 'one',
    }
  }

  // A named range is picked from frappe's own vocabulary, never typed — through the SAME picker every
  // other listed field in this app uses, because a named range IS a listed value. frappe-ui's own select
  // puts no cap on its list and publishes no hook to add one, so a seventeen-row vocabulary hung off the
  // top of a short window with four rows unreachable; our picker has capped its list and scrolled it since
  // the day it was written. One component, one behaviour, nothing overridden.
  if (String(operator).toLowerCase() === 'timespan') {
    return { is: Autocomplete, props: { options: timespanOptions, placeholder: field?.label || '' }, arity: 'one' }
  }

  const source = valuesOf(field)

  if (source.kind === 'inline') {
    // Searchable, and multi when the operator asks for it — the same control either way, which is the
    // whole point: "multi-select" is not a component, it is this control at arity `many`.
    return {
      is: Autocomplete,
      props: { options: source.options, multiple: arity === 'many', placeholder: field?.label || '' },
      arity,
    }
  }

  if (source.kind === 'search') {
    // The SAME picker, holding as many values as the operator asks for. "Multi-select" is not a second
    // component: a searched field and a listed field differ in where their values come from, never in how
    // many you may pick — which is why Source could offer one while Sub-stage offered several.
    return {
      is: Link,
      props: {
        doctype: source.doctype,
        query: source.query,
        multiple: arity === 'many',
        class: 'form-control',
      },
      arity,
    }
  }

  if (DATE.includes(ft)) {
    if (arity === 'range') return { is: DateRangePicker, props: { iconLeft: '' }, arity }
    return { is: ft === 'Datetime' ? DateTimePicker : DatePicker, props: { iconLeft: '' }, arity }
  }
  if (NUMBER.includes(ft)) return { is: FormControl, props: { type: 'number' }, arity }
  if (ft === 'Duration') return { is: DurationInput, props: {}, arity }
  if (ft === 'Rating') return { is: RatingInput, props: { max: Number(field?.options) || 5, class: '!flex' }, arity }
  if (TEXT.includes(ft) || LINKY.includes(ft)) return { is: FormControl, props: { type: 'text' }, arity }
  return { is: FormControl, props: { type: 'text' }, arity }
}
