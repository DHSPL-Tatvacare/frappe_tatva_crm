<!-- TATVA: the buttons a send OFFERS, declared by the author. One row per button, one branch per row. -->
<template>
  <div class="flex flex-col gap-1.5">
    <div v-for="(row, i) in rows" :key="i" class="flex items-center gap-1.5">
      <FormControl
        type="text"
        class="flex-1"
        :modelValue="row.id"
        :disabled="disabled"
        :placeholder="__('Button id, e.g. yes')"
        @update:modelValue="(v) => setId(i, v)"
      />
      <Button
        variant="ghost"
        icon="x"
        :disabled="disabled"
        :label="__('Remove')"
        @click="remove(i)"
      />
    </div>
    <Button
      variant="subtle"
      icon-left="plus"
      :disabled="disabled"
      :label="__('Add button')"
      @click="add"
    />
    <p class="text-p-xs text-ink-gray-5">
      {{ __('The id WhatsApp sends back when a patient taps. A Wait on this send draws one branch per button.') }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Button, FormControl } from 'frappe-ui'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

// Stored as [{id}] — the same rows `outputs_by.rows_from` turns into edges, so the control and the canvas cannot drift.
const rows = computed(() => props.modelValue || [])

function commit(next) {
  emit('update:modelValue', next.filter((r) => (r.id || '').trim()))
}
function setId(i, value) {
  const next = rows.value.map((r, n) => (n === i ? { ...r, id: value } : r))
  emit('update:modelValue', next)
}
function add() {
  emit('update:modelValue', [...rows.value, { id: '' }])
}
function remove(i) {
  commit(rows.value.filter((_, n) => n !== i))
}
</script>
