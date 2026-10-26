// TATVA: the ⌘K query builder's state — which list, its conditions, and how many records match, read through the list's own door so the count is the list's count.
import { call } from 'frappe-ui'
import { ref, shallowRef, watch } from 'vue'
import { parseFilters } from '@/tatva/filterOperators'

// `bulk_actions.MAX_ROWS`: the server refuses a bulk action on more.
export const MAX_BULK = 500
export const QUERY_TAG = 'query'

// { doctype, route, title, one, many, assign, defaults }, set when a builder opens.
export const target = shallowRef(null)
// Each { field, operator, value, label }; replaced, never mutated, so a shallow watch sees every change.
export const conditions = shallowRef([])
// null while counting, a number once counted.
export const matchCount = ref(null)
export const countError = ref('')

export function startQuery(list) {
  target.value = list
  conditions.value = []
}

export function addCondition(condition) {
  conditions.value = [...conditions.value, condition]
}

export function removeCondition(index) {
  conditions.value = conditions.value.filter((_, i) => i !== index)
}

// The filter bar's own writer, so `?filters=` lands on the list exactly as the bar would have set it.
export function queryFilters() {
  return parseFilters(
    conditions.value.map((c) => ({
      fieldname: c.field.fieldname,
      operator: c.operator,
      value: Array.isArray(c.value) ? [...c.value] : c.value,
    })),
  )
}

// `crm.api.doc.get_data`, the list's own read: permissions, grain, stage labels and derived fields resolve as they do on screen.
function listRead(pageLength) {
  return call('crm.api.doc.get_data', {
    doctype: target.value.doctype,
    filters: queryFilters(),
    default_filters: target.value.defaults || null,
    order_by: 'modified desc',
    page_length: pageLength,
    page_length_count: pageLength,
    columns: [{ label: 'Name', type: 'Data', key: 'name' }],
    rows: ['name'],
    view: { view_type: 'list' },
  })
}

// The records a bulk action acts on; more than the server takes is refused here, readably.
export async function matchingNames() {
  const result = await listRead(MAX_BULK)
  if (result.total_count > MAX_BULK) {
    throw {
      messages: [
        __(
          '{0} records match. Bulk actions take up to {1}; narrow the filter.',
          [result.total_count, MAX_BULK],
        ),
      ],
    }
  }
  return result.data.map((row) => row.name)
}

let token = 0
let timer = null

// Recounted on every change, debounced; a token drops an answer that lands under newer conditions.
watch([target, conditions], () => {
  clearTimeout(timer)
  const mine = ++token
  matchCount.value = null
  countError.value = ''
  if (!target.value) return
  timer = setTimeout(async () => {
    try {
      const result = await listRead(1)
      if (mine === token) matchCount.value = result.total_count
    } catch (error) {
      // Surfaced: the strip shows the server's reason in place of a count.
      if (mine === token)
        countError.value =
          error?.messages?.[0] || __('Could not count the matches')
    }
  }, 250)
})
