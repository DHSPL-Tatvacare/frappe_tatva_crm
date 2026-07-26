<!-- TATVA: one rail node for the Activity tab — the type icon sits ON the connecting line, a header carries
     `avatar · Name · verb · when`, and the default slot holds the body (an <ActivityCard showTypeIcon=false>
     for the four card types, or a self-contained renderer for comment/email). Reuses the SAME rail grid +
     `before:` connecting line the Activity/Emails feed already draws. `bare` skips the header for a body
     that renders its own (CommentArea / EmailArea). An automation actor (`actor.to`) reads as a deep-link
     to the lead's Workflow tab with the workflow glyph, no avatar. Dumb: it renders and slots, nothing more. -->
<template>
  <div class="activity grid grid-cols-[30px_minmax(auto,_1fr)] gap-2 px-3 sm:gap-4 sm:px-10">
    <!-- node on the connecting line -->
    <div
      class="z-0 relative flex justify-center before:absolute before:left-[50%] before:-z-[1] before:top-0 before:border-l before:border-outline-gray-modals"
      :class="last ? 'before:h-4' : 'before:h-full'"
    >
      <div class="mt-1 flex h-7 w-7 items-center justify-center bg-surface-white">
        <component :is="icon" class="text-ink-gray-8" />
      </div>
    </div>
    <!-- header (avatar · name · verb · when) + body -->
    <div class="mb-4 min-w-0 pt-1">
      <div v-if="!bare" class="mb-1.5 flex items-center gap-1.5 text-xs text-ink-gray-5">
        <template v-if="actor.to">
          <component :is="actor.iconComp" v-if="actor.iconComp" class="size-3.5 shrink-0 text-ink-gray-6" />
          <RouterLink :to="actor.to" class="truncate font-medium text-ink-gray-8 hover:underline">
            {{ actor.label }}
          </RouterLink>
        </template>
        <template v-else>
          <Avatar :label="actor.label" :image="actor.image" size="xs" />
          <span class="truncate font-medium text-ink-gray-8">{{ actor.label }}</span>
        </template>
        <span v-if="verb" class="truncate">{{ verb }}</span>
        <span aria-hidden="true">·</span>
        <Tooltip :text="formatDate(at)">
          <span class="whitespace-nowrap">{{ timeAgo(at) }}</span>
        </Tooltip>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { Avatar, Tooltip } from 'frappe-ui'
import { formatDate, timeAgo } from '@/utils'

defineProps({
  icon: { type: [Object, Function], default: null }, // the type icon on the connecting line
  actor: { type: Object, default: () => ({ label: '', image: '' }) }, // { label, image } | { label, iconComp, to }
  verb: { type: String, default: '' }, // "logged a task" / "moved stage X → Y" / …
  at: { type: String, default: '' },
  bare: { type: Boolean, default: false }, // skip the header (the body renders its own — comment / email)
  last: { type: Boolean, default: false }, // shorten the connecting line on the final row
})
</script>
