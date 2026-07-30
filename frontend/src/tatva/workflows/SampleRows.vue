<!-- TATVA: the arms a Sample splits into — (label, percent). One row per arm, one handle per row, plus a
     reserved Remainder that takes whatever share is left. Rows are DRAG-REORDERABLE like a Route's, and the
     id never changes on a reorder, so the edge wired to an arm follows it. Order does NOT decide who lands
     where — a lead's arm is a stable hash of lead + node, computed on the server — so reordering is
     presentation only. Same {id,label} row shape as a Route row and a Wait button. -->
<template>
  <div class="flex flex-col gap-2">
    <div ref="listEl" class="flex flex-col gap-2">
      <div
        v-for="(row, i) in rows"
        :key="row.id"
        class="flex items-center gap-1.5 rounded-md border border-outline-gray-2 bg-surface-gray-1 p-2"
      >
        <div
          class="sample-drag flex h-7 w-5 shrink-0 items-center justify-center"
          :class="disabled ? 'pointer-events-none opacity-40' : 'cursor-grab'"
        >
          <DragVerticalIcon class="h-4 w-4 text-ink-gray-5" />
        </div>
        <FormControl
          type="text"
          class="flex-1"
          :modelValue="row.label"
          :disabled="disabled"
          :placeholder="__('Label, e.g. Treatment')"
          @update:modelValue="(v) => setLabel(i, v)"
        />
        <div class="flex w-24 shrink-0 items-center gap-1">
          <FormControl
            type="number"
            class="flex-1"
            :modelValue="row.percent"
            :disabled="disabled"
            placeholder="0"
            @update:modelValue="(v) => setPercent(i, v)"
          />
          <span class="text-xs text-ink-gray-5">%</span>
        </div>
        <Button variant="ghost" icon="x" :disabled="disabled" :label="__('Remove')" @click="remove(i)" />
      </div>
    </div>

    <Button
      variant="subtle"
      icon-left="plus"
      :disabled="disabled"
      :label="__('Add arm')"
      @click="add"
    />

    <!-- Reserved and always present, exactly like a Route's Otherwise: the leftover share has somewhere to
         go, so the arms never have to add up to 100. Over 100 is refused at publish, by the server. -->
    <div
      class="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs"
      :class="over ? 'border-outline-red-2 text-ink-red-3' : 'border-outline-gray-3 text-ink-gray-5'"
    >
      <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-gray-4">*</span>
      <span v-if="over">
        {{ __('The arms add up to {0}% — more than the whole. Publish will refuse this.', [total]) }}
      </span>
      <span v-else>
        {{ __('Remainder — the {0}% not taken by an arm above. Wire it so no one falls through.', [100 - total]) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Button, FormControl } from 'frappe-ui'
import { useSortable } from '@vueuse/integrations/useSortable'
import DragVerticalIcon from '@/components/Icons/DragVerticalIcon.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

// Local render source, so `useSortable` (which mutates its list on drop, exactly like RouteRows.vue) and
// Vue agree on the DOM. Synced FROM the parent only when the parent genuinely differs, so our own emits —
// a keystroke in a label — never recycle the array under the author's cursor.
const rows = ref(clone(props.modelValue))
watch(
  () => props.modelValue,
  (v) => {
    if (JSON.stringify(v || []) !== JSON.stringify(rows.value)) rows.value = clone(v)
  },
)

const listEl = ref(null)
useSortable(listEl, rows, {
  handle: '.sample-drag',
  animation: 150,
  onEnd: () => emit('update:modelValue', rows.value),
})

// The SAME arithmetic the server refuses on, shown while the author types rather than at publish. It is a
// preview of the server's answer, never a second decider — publish still asks the backend.
const total = computed(() =>
  rows.value.reduce((sum, r) => sum + (Number(r.percent) || 0), 0),
)
const over = computed(() => total.value > 100)

function clone(v) {
  return JSON.parse(JSON.stringify(v || []))
}
// A stable id per row so reordering or renaming never re-keys the edge wired to it. Not Date.now()-based:
// two rows added in the same tick would collide.
function newId() {
  return 'a' + Math.random().toString(36).slice(2, 8)
}
function commit(next) {
  rows.value = next
  emit('update:modelValue', next)
}
function setLabel(i, value) {
  commit(rows.value.map((r, n) => (n === i ? { ...r, label: value } : r)))
}
function setPercent(i, value) {
  const percent = value === '' || value === null ? null : Number(value)
  commit(rows.value.map((r, n) => (n === i ? { ...r, percent } : r)))
}
function add() {
  commit([...rows.value, { id: newId(), label: '', percent: null }])
}
function remove(i) {
  commit(rows.value.filter((_, n) => n !== i))
}
</script>
