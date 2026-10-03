<template>
  <span class="inline-flex items-center justify-center">
    <span
      class="size-2.5 shrink-0 rounded-full"
      :class="dot"
      aria-hidden="true"
    />
  </span>
</template>

<script setup>
// TATVA: the check-in dot, sized as Helpdesk's availability dot and in its status colours (green, amber, red), using the strongest shades this frappe-ui ships.
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: '' },
})

// Complete class strings only (Tailwind scanner). No status yet is grey, as Helpdesk's default.
const DOTS = {
  Active: 'bg-surface-green-3',
  Away: 'bg-surface-amber-3',
  Unavailable: 'bg-surface-red-5',
}
const dot = computed(() => DOTS[props.status] || 'bg-surface-gray-4')
</script>
