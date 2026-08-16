<!-- TATVA: one switch row, shared by the push and email screens so the two cannot drift apart visually. -->
<template>
  <div class="flex items-center justify-between gap-3 px-4 py-3">
    <div class="flex flex-col pr-5">
      <div
        class="text-p-base font-medium"
        :class="muted ? 'text-ink-gray-4' : 'text-ink-gray-8'"
      >
        {{ label }}
      </div>
      <div
        v-if="description"
        class="text-p-sm"
        :class="muted ? 'text-ink-gray-4' : 'text-ink-gray-5'"
      >
        {{ description }}
      </div>
    </div>
    <Switch
      size="sm"
      :disabled="disabled"
      :model-value="modelValue"
      @update:model-value="(val) => emit('update:modelValue', val)"
    />
  </div>
</template>

<script setup>
import { Switch } from 'frappe-ui'

defineProps({
  label: { type: String, required: true },
  description: { type: String, default: '' },
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  muted: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
</script>
