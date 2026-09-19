<!-- TATVA: a read-only answer about a node's current settings, from the method its declaration names. -->
<template>
  <div class="rounded border border-outline-gray-2 bg-surface-gray-1 p-3">
    <div class="flex items-center gap-2">
      <div class="text-xs font-medium text-ink-gray-7">{{ __(label) }}</div>
      <div class="flex-1" />
      <Button :label="__('Check')" iconLeft="play" :loading="probe.loading" @click="probe.fetch()" />
    </div>

    <ErrorMessage v-if="probe.error" class="mt-2" :message="probe.error" />
    <div v-else-if="probe.data" class="mt-2 flex flex-col gap-1">
      <div v-for="row in probe.data" :key="row.label" class="flex items-baseline justify-between gap-3">
        <span class="shrink-0 text-xs text-ink-gray-5">{{ __(row.label) }}</span>
        <span class="min-w-0 truncate text-right text-xs font-medium text-ink-gray-8">{{ row.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { Button, ErrorMessage, createResource } from 'frappe-ui'

const props = defineProps({
  // Declared with the node type: the whitelisted method that answers `[{label, value}]` for a config.
  method: { type: String, required: true },
  label: { type: String, required: true },
  config: { type: Object, default: () => ({}) },
})

// Fetched only when the author asks, like every other preview on this canvas.
const probe = createResource({
  url: props.method,
  makeParams: () => ({ config: JSON.stringify(props.config) }),
})

// Any edit invalidates the answer: a stale next run is a lie about when patients are reached.
watch(() => JSON.stringify(props.config), () => probe.reset())
</script>
