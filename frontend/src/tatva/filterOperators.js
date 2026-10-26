// TATVA: the filter bar's operator menu and filter writer, lifted out of Filter.vue unchanged, so the ⌘K query builder and the bar speak one filter language.
import { narrowOperators } from '@/tatva/derivedField'

export const typeCheck = ['Check']
export const typeLink = ['Link', 'Dynamic Link']
export const typeNumber = ['Float', 'Int', 'Currency', 'Percent']
// An Autocomplete carries the same newline option list a Select does, so it takes the same operators.
export const typeSelect = ['Select', 'Autocomplete']
export const typeString = [
  'Data',
  'Long Text',
  'Small Text',
  'Text Editor',
  'Text',
]
export const typeDate = ['Date', 'Datetime']
export const typeDuration = ['Duration']
export const typeRating = ['Rating']

export function getOperators(fieldtype, fieldname, fields) {
  let options = []
  if (typeString.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Like'), value: 'like' },
        { label: __('Not like'), value: 'not like' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  if (fieldname === '_assign') {
    // TODO: make equals and not equals work
    options = [
      { label: __('Like'), value: 'like' },
      { label: __('Not like'), value: 'not like' },
      { label: __('Is'), value: 'is' },
    ]
  }
  if (typeNumber.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Like'), value: 'like' },
        { label: __('Not like'), value: 'not like' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
        { label: __('<'), value: '<' },
        { label: __('>'), value: '>' },
        { label: __('<='), value: '<=' },
        { label: __('>='), value: '>=' },
      ],
    )
  }
  if (typeSelect.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  if (typeLink.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Like'), value: 'like' },
        { label: __('Not like'), value: 'not like' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  if (typeCheck.includes(fieldtype)) {
    options.push(...[{ label: __('Equals'), value: 'equals' }])
  }
  if (typeDuration.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Like'), value: 'like' },
        { label: __('Not like'), value: 'not like' },
        { label: __('In'), value: 'in' },
        { label: __('Not in'), value: 'not in' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  if (typeDate.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Is'), value: 'is' },
        { label: __('>'), value: '>' },
        { label: __('<'), value: '<' },
        { label: __('>='), value: '>=' },
        { label: __('<='), value: '<=' },
        { label: __('Between'), value: 'between' },
        { label: __('Timespan'), value: 'timespan' },
      ],
    )
  }
  if (typeRating.includes(fieldtype)) {
    options.push(
      ...[
        { label: __('Equals'), value: 'equals' },
        { label: __('Not equals'), value: 'not equals' },
        { label: __('Greater than'), value: '>' },
        { label: __('Less than'), value: '<' },
        { label: __('Greater than or equal to'), value: '>=' },
        { label: __('Less than or equal to'), value: '<=' },
        { label: __('Is'), value: 'is' },
      ],
    )
  }
  // TATVA: same narrowing as `_assign` above, keyed off the server descriptor rather than a fieldname.
  return narrowOperators(options, fields, fieldname)
}

export function getDefaultOperator(fieldtype) {
  if (typeSelect.includes(fieldtype)) {
    return 'equals'
  }
  if (typeCheck.includes(fieldtype) || typeNumber.includes(fieldtype)) {
    return 'equals'
  }
  if (typeDate.includes(fieldtype)) {
    return 'between'
  }
  return 'like'
}

export function parseFilters(filters) {
  const filtersArray = Array.from(filters)
  const obj = filtersArray.map(transformIn).reduce((p, c) => {
    if (['equals', '='].includes(c.operator)) {
      p[c.fieldname] =
        c.value == 'Yes' ? true : c.value == 'No' ? false : c.value
    } else {
      p[c.fieldname] = [operatorMap[c.operator.toLowerCase()], c.value]
    }
    return p
  }, {})
  const merged = { ...obj }
  return merged
}

function transformIn(f) {
  if (f.operator.includes('like') && !f.value.includes('%')) {
    f.value = `%${f.value}%`
  }
  if (['in', 'not in'].includes(f.operator) && typeof f.value === 'string') {
    f.value = f.value.split(',').map((v) => v.trim())
  }
  return f
}

export const operatorMap = {
  is: 'is',
  'is not': 'is not',
  in: 'in',
  'not in': 'not in',
  equals: '=',
  'not equals': '!=',
  yes: true,
  no: false,
  like: 'LIKE',
  'not like': 'NOT LIKE',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  between: 'between',
  timespan: 'timespan',
}
