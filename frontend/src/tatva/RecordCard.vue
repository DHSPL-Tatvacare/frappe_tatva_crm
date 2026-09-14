<!-- TATVA: a generic read-only record card — a header (avatar, title, #actions slot) over label/value rows; it knows no doctype and renders what it is handed. -->
<template>
  <div class="flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-lg bg-surface-modal shadow-2xl ring-1 ring-outline-gray-2">
    <div v-if="loading" class="animate-pulse">
      <div class="flex items-center gap-3 border-b border-outline-gray-1 px-3 py-2.5">
        <div class="size-8 shrink-0 rounded-full bg-surface-gray-3" />
        <div class="h-3 w-1/2 rounded bg-surface-gray-3" />
      </div>
      <div v-for="n in 4" :key="n" class="flex items-center gap-3 px-3 py-3">
        <div class="h-2.5 w-20 shrink-0 rounded bg-surface-gray-2" />
        <div class="h-2.5 flex-1 rounded bg-surface-gray-3" />
      </div>
    </div>

    <div v-else-if="message" class="px-3 py-2.5 text-p-sm text-ink-gray-5">{{ message }}</div>

    <template v-else>
      <div class="flex shrink-0 items-center gap-3 border-b border-outline-gray-1 px-3 py-2.5">
        <Avatar size="lg" :label="title" :image="image" class="shrink-0" />
        <div class="min-w-0 flex-1 truncate text-base font-medium text-ink-gray-9">{{ title }}</div>
        <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1">
          <slot name="actions" />
        </div>
      </div>

      <dl class="min-h-0 flex-1 divide-y divide-outline-gray-1 overflow-y-auto">
        <div v-for="row in rows" :key="row.label" class="flex items-start gap-3 px-3 py-2">
          <dt class="w-28 shrink-0 text-p-xs leading-5 text-ink-gray-5">{{ row.label }}</dt>
          <dd class="min-w-0 flex-1 break-words text-p-sm leading-5 text-ink-gray-8">{{ row.value || '—' }}</dd>
        </div>
      </dl>
    </template>
  </div>
</template>

<script setup>
import { Avatar } from 'frappe-ui'

defineProps({
  title: { type: String, default: '' },
  image: { type: String, default: '' },
  // [{ label, value }] in reading order; a blank value reads as a dash so every card keeps its shape.
  rows: { type: Array, default: () => [] },
  // Replaces the whole card with one muted line — a refusal or a failure, never an error style.
  message: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})
</script>
