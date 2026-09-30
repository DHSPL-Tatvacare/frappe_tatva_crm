// TATVA: the one reorderable row list behind Route and Sample rows: a local copy vueuse's useSortable can reorder, synced from the parent only when it genuinely differs.
import { ref, watch } from 'vue'
import { useSortable } from '@vueuse/integrations/useSortable'

const clone = (v) => JSON.parse(JSON.stringify(v || []))

export function useSortableRows(props, emit, { handle, prefix, blank }) {
  const rows = ref(clone(props.modelValue))
  // Synced only on a real difference, so a keystroke's own emit never recycles the array under the cursor.
  watch(
    () => props.modelValue,
    (v) => {
      if (JSON.stringify(v || []) !== JSON.stringify(rows.value)) rows.value = clone(v)
    },
  )

  const listEl = ref(null)
  // Reorder moves rows only; each row's stable id is untouched, so the edge keyed on it follows its row.
  useSortable(listEl, rows, { handle, animation: 150, onEnd: () => emit('update:modelValue', rows.value) })

  function commit(next) {
    rows.value = next
    emit('update:modelValue', next)
  }
  // A stable random id per row, never time-based: two rows added in one tick would collide.
  const newId = () => prefix + Math.random().toString(36).slice(2, 8)
  const setField = (i, key, value) => commit(rows.value.map((r, n) => (n === i ? { ...r, [key]: value } : r)))
  const add = () => commit([...rows.value, { id: newId(), ...blank }])
  const remove = (i) => commit(rows.value.filter((_, n) => n !== i))

  return { rows, listEl, setField, add, remove }
}
