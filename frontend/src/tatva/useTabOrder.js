// TATVA: the one brain for a personal tab order — the draggable copy, its save on drop and its reset, shared by the rail and the sheet.
import { call, toast } from 'frappe-ui'
import { ref, watch } from 'vue'

export function useTabOrder(referenceDoctype, views, onReordered) {
  // vuedraggable mutates the list it is handed, so it gets a copy, reseeded whenever the server's order comes back.
  const rows = ref([])
  const ordered = ref(false)
  watch(views, (v) => (rows.value = [...(v || [])]), { immediate: true })

  async function save(order) {
    try {
      await call('tatva_connect.tab_order.save_order', {
        reference_doctype: referenceDoctype,
        order: JSON.stringify(order),
      })
      return true
    } catch (e) {
      toast.error(e?.messages?.[0] || __('Could not save this order'))
      return false
    }
  }

  async function persist() {
    if (!(await save(rows.value.map((r) => r.name)))) return
    ordered.value = true
    onReordered()
  }

  async function resetOrder() {
    if (!(await save([]))) return
    ordered.value = false
    onReordered()
  }

  return { rows, ordered, persist, resetOrder }
}
