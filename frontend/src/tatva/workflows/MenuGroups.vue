<!-- TATVA: a grouped menu in frappe-ui Dropdown's own look, for a menu Dropdown cannot draw (opened from code, capped height that scrolls); the host fills each row through the slot. -->
<template>
  <div class="max-h-80 divide-y divide-outline-gray-modals overflow-y-auto">
    <div v-for="group in groups" :key="group.key" class="p-1.5">
      <div class="flex h-7 items-center px-2 text-sm font-medium text-ink-gray-5">{{ group.label }}</div>
      <button
        v-for="(item, i) in group.items"
        :key="i"
        type="button"
        class="flex min-h-7 w-full items-center gap-2 rounded px-2 py-1 text-left text-base text-ink-gray-7 hover:bg-surface-gray-3 focus:bg-surface-gray-3 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="item.disabled"
        @click="emit('select', item)"
      >
        <slot name="item" :item="item" />
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  // `[{ key, label, items: [{ disabled?, ... }] }]`.
  groups: { type: Array, required: true },
})
const emit = defineEmits(['select'])
</script>
