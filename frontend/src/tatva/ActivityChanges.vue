<template>
  <div class="flex flex-col gap-1 text-p-sm text-ink-gray-6">
    <div
      v-for="(line, i) in shown"
      :key="i"
      class="flex min-w-0 flex-wrap items-center gap-1.5"
    >
      <span class="shrink-0 text-ink-gray-5">{{ line.label }}</span>
      <span v-if="line.from" class="min-w-0 truncate line-through">{{
        line.from
      }}</span>
      <FeatherIcon
        v-if="line.from"
        name="arrow-right"
        class="size-3 shrink-0 text-ink-gray-4"
      />
      <span class="min-w-0 truncate font-medium text-ink-gray-8">{{
        line.to || __('(cleared)')
      }}</span>
    </div>
    <button
      v-if="changes.length > 1"
      class="w-fit text-p-sm text-ink-gray-5 underline underline-offset-2 hover:text-ink-gray-8"
      @click="open = !open"
    >
      {{ open ? __('Show less') : __('+{0} more', [changes.length - 1]) }}
    </button>
  </div>
</template>

<script setup>
// One save's field changes, collapsed the way native collapses a burst — first line, then "+N more".
import { computed, ref } from 'vue'
import { FeatherIcon } from 'frappe-ui'

const props = defineProps({ changes: { type: Array, default: () => [] } })

const open = ref(false)
const shown = computed(() =>
  open.value ? props.changes : props.changes.slice(0, 1),
)
</script>
