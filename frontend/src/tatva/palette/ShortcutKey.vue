<!-- TATVA: Helpdesk's ShortcutKey cap, so a key reads the same in both apps; `keys` is a SHORTCUTS entry's own list. -->
<template>
  <span class="inline-flex items-center gap-1">
    <kbd
      v-for="(key, index) in keys"
      :key="index"
      class="flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-outline-gray-2 bg-surface-white px-1 pt-px font-sans text-xs text-ink-gray-5"
    >
      {{ key }}
    </kbd>
  </span>
</template>

<script setup>
defineProps({ keys: { type: Array, required: true } })
</script>
