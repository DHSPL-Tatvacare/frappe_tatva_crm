<!-- TATVA: one palette row, Helpdesk's CommandPaletteRow; a record row adds the CRM's second line (number and grain) and its stage. -->
<template>
  <div
    class="flex w-full min-w-0 rounded px-2 text-sm leading-snug text-ink-gray-8"
    :class="[active && 'bg-surface-gray-2', command.meta?.length ? 'items-start py-1.5' : 'h-9 items-center']"
  >
    <Avatar v-if="command.avatar" :image="command.avatar.image" :label="command.avatar.label" size="xs" class="me-2.5 shrink-0" />
    <!-- Boxed to the icon's width, so a dot row's title lands on the same axis. -->
    <span v-else-if="command.dotClass" class="me-2.5 flex h-5 w-3.5 shrink-0 items-center justify-center">
      <span class="size-2 rounded-full bg-current" :class="command.dotClass" />
    </span>
    <span
      v-else-if="command.icon"
      class="me-2.5 flex h-5 shrink-0 items-center [&>*]:size-3.5"
      :class="active ? 'text-ink-gray-7' : 'text-ink-gray-5'"
    >
      <Icon :icon="command.icon" />
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex h-5 min-w-0 items-center">
        <span class="min-w-0 flex-1 truncate">
          <template v-for="(run, index) in runs" :key="index">
            <mark v-if="run.match" class="bg-transparent font-medium text-ink-gray-9">{{ run.text }}</mark>
            <template v-else>{{ run.text }}</template>
          </template>
        </span>
        <!-- Desktop only, by CSS: a phone row keeps its width for the title. -->
        <Badge v-if="command.badge" variant="outline" theme="gray" size="sm" class="ms-3 hidden max-w-[40%] shrink-0 md:flex">
          <span class="truncate">{{ command.badge }}</span>
        </Badge>
      </span>
      <!-- A line breaks after a separator, never inside a value: `Niva-Bupa` must not split at its hyphen. -->
      <span v-if="command.meta?.length" class="line-clamp-2 block text-xs text-ink-gray-5">
        <template v-for="(part, k) in command.meta" :key="k">
          <span v-if="k" aria-hidden="true">&nbsp;· </span>
          <span class="whitespace-nowrap" :class="part.strong && 'font-medium text-ink-gray-7'">
            <span v-if="part.label" class="text-ink-gray-4">{{ __(part.label) }}:&nbsp;</span>
            <template v-for="(run, i) in part.runs" :key="i">
              <mark v-if="run.match" class="bg-transparent font-medium text-ink-gray-9">{{ run.text }}</mark>
              <template v-else>{{ run.text }}</template>
            </template>
          </span>
        </template>
      </span>
    </span>

    <!-- Shrinks before the title does: a long email or patient name must not take a phone row's width. -->
    <span v-if="command.subtitle" class="ms-3 h-5 min-w-0 max-w-[45%] truncate text-xs leading-5 text-ink-gray-4">
      {{ command.subtitle }}
    </span>
    <LucideCheck v-if="command.checked" class="ms-3 mt-[3px] size-3.5 shrink-0 text-ink-gray-7" />
    <ShortcutKey v-if="command.hint" :keys="command.hint" class="ms-3 hidden shrink-0 sm:inline-flex" />
    <LucideChevronRight v-if="command.children" class="ms-2 mt-[3px] size-3.5 shrink-0 text-ink-gray-4" />
  </div>
</template>

<script setup>
import Icon from '@/components/Icon.vue'
import { Avatar, Badge } from 'frappe-ui'
import { computed } from 'vue'
import LucideCheck from '~icons/lucide/check'
import LucideChevronRight from '~icons/lucide/chevron-right'
import ShortcutKey from './ShortcutKey.vue'
import { titleRuns } from './paletteTypes'

const props = defineProps({
  command: { type: Object, required: true },
  active: { type: Boolean, default: false },
})

// The server's own highlighting when it sent some, else one plain run.
const runs = computed(() =>
  props.command.marked ? titleRuns(props.command.marked) : [{ text: props.command.title, match: false }],
)
</script>
