// TATVA: shared toolbar state for the activity tabs (Comments / Notes / Calls / Tasks / Attachments).
// ActivityHeader renders the search box + the native Filter off this; the active tab publishes its
// filter `fields` and reads `search` + `predicate` to filter its ALREADY-LOADED items client-side
// (no extra API call, no per-tab bespoke state). Generalises the old taskFilter to every tab.
import { reactive } from 'vue'

export const activityToolbar = reactive({
  search: '', // free-text query, applied by the active tab over its own searchable text
  fields: [], // [{fieldname, fieldtype, label, options}] the active tab publishes for Filter.vue
  model: { data: {}, params: { filters: {} } }, // Filter.vue v-model (list-shaped)
  predicate: null, // { op:'and', conditions:[{field, operator, value}] } set on Filter @update
  hasData: false, // the active tab has items (UNFILTERED) -> show search + Filter; else just the empty state
  // TATVA: `<field> <asc|desc>`, read by the server-paged tabs. Two fields only — when a thing happened
  // and when it last changed — which is the whole vocabulary these tabs need, and both are indexed.
  orderBy: 'creation desc',
  // TATVA: the pinned footer is CHROME, mounted once outside the scroller; a tab owning its own resource publishes its counts here.
})

export function resetActivityToolbar() {
  activityToolbar.search = ''
  activityToolbar.fields = []
  activityToolbar.model = { data: {}, params: { filters: {} } }
  activityToolbar.predicate = null
  activityToolbar.hasData = false
  activityToolbar.orderBy = 'creation desc'
}
