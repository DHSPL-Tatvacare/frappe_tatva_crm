// TATVA: shared state so the native Filter.vue (mounted in ActivityHeader, left of New Task) drives the
// lead Tasks board (TatvaTasks). The board publishes `fields`; the Filter writes `model` + `predicate`;
// the board reads `predicate` to filter cards client-side. No custom filter UI — Filter.vue is native.
import { reactive } from 'vue'

export const taskFilter = reactive({
  fields: [], // [{fieldname, fieldtype, label, options}] published by the board for the Filter UI
  model: { data: {}, params: { filters: {} } }, // Filter.vue v-model (list-shaped)
  predicate: null, // { op:'and', conditions:[{field, operator, value}] } set on @update, read by the board
})

export function resetTaskFilter() {
  taskFilter.fields = []
  taskFilter.model = { data: {}, params: { filters: {} } }
  taskFilter.predicate = null
}
