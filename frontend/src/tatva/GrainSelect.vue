<!--
  TATVA: GrainSelect — the grain control for the Lead/Deal create modal, on the ONE grain brain
  (useEntitledGrains). A single-grain user sees a read-only confirmation and is NEVER asked (the
  value is applied silently); a manager with multiple grains gets a required picker; a System Manager
  sees nothing here (the modal keeps the native vertical/group fields for them). v-model is the
  `vertical::group::program` key — the parent maps it onto the doc with axesFromKey.
-->
<template>
  <div v-if="!grainAll && (grainOptions.length || grainLoading)">
    <div class="mb-1.5 text-sm text-ink-gray-5">{{ __('Grain') }}</div>
    <FormControl
      v-if="!grainLocked"
      :modelValue="modelValue"
      type="select"
      :options="grainOptions"
      :placeholder="__('Select a grain')"
      :disabled="disabled"
      @update:modelValue="(v) => emit('update:modelValue', v)"
    />
    <div
      v-else
      class="flex items-center gap-1.5 rounded bg-surface-gray-2 px-2.5 py-2 text-sm text-ink-gray-7"
    >
      <FeatherIcon name="lock" class="size-3.5 shrink-0 text-ink-gray-5" />
      {{ grainOptions[0]?.label }}
    </div>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { FormControl, FeatherIcon } from 'frappe-ui'
import { useEntitledGrains } from '@/tatva/useEntitledGrains'

// `disabled` is for a consumer where the grain is settled and may not move (editing a saved Smart View).
const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const { grainAll, grainOptions, grainLocked, grainLoading } = useEntitledGrains()

// Single grain → apply silently so the parent always has the value, without a prompt.
watch(
  [grainLocked, grainOptions],
  () => {
    if (grainLocked.value && grainOptions.value.length && !props.modelValue) {
      emit('update:modelValue', grainOptions.value[0].value)
    }
  },
  { immediate: true },
)
</script>
