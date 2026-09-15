<!-- TATVA: one row for any result list — icon tile, title, meta line, trailing affordance. Knows nothing
     about doctypes or fields, so a design change lands here instead of inside someone's v-for. -->
<template>
  <button
    type="button"
    tabindex="-1"
    class="flex w-full gap-3 px-4 text-left transition-colors"
    :class="[
      selected ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-2',
      dense ? 'py-2.5' : 'py-3',
      $slots.meta && !dense ? 'items-start' : 'items-center',
    ]"
    @click="$emit('select')"
    @mouseenter="$emit('hover')"
  >
    <!-- One step darker than the row's own hover token, or the tile vanishes the moment you hover it. -->
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-gray-3 text-ink-gray-7"
      :class="$slots.meta && !dense ? 'mt-0.5' : ''"
    >
      <slot name="icon" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1 truncate text-sm font-medium text-ink-gray-9"><slot name="title" /></div>
        <!-- Desktop only, by CSS: a phone row keeps its width for the title and meta. -->
        <div v-if="badge" class="hidden min-w-0 max-w-[50%] shrink-0 md:flex">
          <Badge variant="outline" theme="gray" size="sm" class="max-w-full">
            <span class="truncate">{{ badge }}</span>
          </Badge>
        </div>
      </div>
      <div v-if="$slots.meta" class="mt-0.5 flex items-center gap-3 text-xs text-ink-gray-5">
        <div class="line-clamp-2 min-w-0 flex-1"><slot name="meta" /></div>
        <div v-if="person" class="hidden shrink-0 md:flex">
          <!-- The avatar's empty fill is the selected row's own token, so it sits on a white disc. -->
          <Tooltip :text="person">
            <span class="flex rounded-full bg-surface-white p-px"><Avatar :label="person" size="xs" /></span>
          </Tooltip>
        </div>
      </div>
    </div>
    <!-- Pinned to the row's edge, so it cannot drift with the length of the title beside it. -->
    <div v-if="$slots.trailing" class="ml-auto flex shrink-0 items-center self-center text-ink-gray-4">
      <slot name="trailing" />
    </div>
  </button>
</template>

<script setup>
import { Avatar, Badge, Tooltip } from 'frappe-ui'

defineProps({
  selected: { type: Boolean, default: false },
  dense: { type: Boolean, default: false },
  // A short status beside the title, and the person the row belongs to beside the meta; both optional.
  badge: { type: String, default: '' },
  person: { type: String, default: '' },
})
defineEmits(['select', 'hover'])
</script>
