// TATVA: shared client-side filter for the lead Tasks board (status + task type). TatvaTasks publishes
// the available options and reads the selection; TaskFilter (in the ActivityHeader) writes it. No backend.
import { reactive } from 'vue'

export const taskFilter = reactive({
  statuses: [], // available statuses, published by the board
  taskTypes: [], // available task types, published by the board
  status: [], // selected statuses
  type: [], // selected task types
})

export const taskFilterCount = () => taskFilter.status.length + taskFilter.type.length

export function resetTaskFilter() {
  taskFilter.statuses = []
  taskFilter.taskTypes = []
  taskFilter.status = []
  taskFilter.type = []
}
