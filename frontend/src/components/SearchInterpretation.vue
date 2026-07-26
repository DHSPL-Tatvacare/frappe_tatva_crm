<!--
  TATVA: the ONE interpretation line — what the SERVER understood of the typed words, read-only. Both device
  shells (TatvaSpotlight, TatvaBottomSheet) render this same markup; it lived twice and a fix landed on one
  copy while the other was tested. Spacing is NOT a prop: the caller's `class` falls through to the root.
-->
<template>
  <div v-if="understood" class="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-gray-5">
    <template v-for="(f, i) in understood.filters" :key="f.column">
      <span v-if="i" aria-hidden="true" class="text-ink-gray-4">·</span>
      <span>{{ __(f.label) }}: <span class="text-ink-gray-7">{{ f.value }}</span></span>
    </template>
    <template v-if="understood.text">
      <span v-if="understood.filters.length" aria-hidden="true" class="text-ink-gray-4">·</span>
      <span>{{ __('matching') }} <span class="text-ink-gray-7">“{{ understood.text }}”</span></span>
    </template>
  </div>
</template>

<script setup>
// The server's own reading, or null — absent whenever the split resolved nothing, so the line simply isn't drawn.
defineProps({ understood: { type: Object, default: null } })
</script>
