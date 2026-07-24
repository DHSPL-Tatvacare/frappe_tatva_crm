<!-- eslint-disable vue/no-v-html -->
<!-- TATVA: spotlight result rows — one source of truth. Compact on desktop, roomier on mobile.
     Rows persist during a reload (no bounce); only the typed characters are highlighted. -->
<template>
  <div class="min-h-[8rem]">
    <ul v-if="hits.length">
      <li v-for="(hit, i) in hits" :key="hit.doctype + ':' + hit.name">
        <button
          class="flex w-full gap-3 px-4 text-left transition-colors"
          :class="[
            i === selected ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-2',
            isMobileView ? 'items-start py-3' : 'items-center py-2.5',
          ]"
          @click="$emit('select', hit)"
          @mouseenter="$emit('hover', i)"
        >
          <!-- Colored type tile — the type is read from colour + icon, so no text label is needed. -->
          <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg" :class="TYPE[hit.doctype].tile">
            <component :is="TYPE[hit.doctype].icon" class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-ink-gray-9" v-html="highlight(hit.title)" />
              <Badge v-if="hit.status" :label="hit.status" theme="blue" variant="subtle" size="sm" class="shrink-0" />
            </div>
            <div v-if="hit.doctype === 'CRM Lead'" class="mt-0.5 truncate text-xs text-ink-gray-5">
              {{ leadMeta(hit) }}
            </div>
            <div v-else class="mt-0.5 truncate text-xs text-ink-gray-5" v-html="highlight(hit.snippet)" />
            <Badge
              v-if="isMobileView && hit.assignee"
              :label="hit.assignee"
              theme="green"
              variant="subtle"
              size="sm"
              class="mt-1.5"
            />
          </div>
          <!-- Desktop: assignee on the right. -->
          <Badge
            v-if="!isMobileView && hit.assignee"
            :label="hit.assignee"
            theme="green"
            variant="subtle"
            size="sm"
            class="shrink-0"
          />
        </button>
      </li>
    </ul>

    <div v-else-if="loading" class="flex justify-center py-12">
      <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
    </div>
    <div v-else-if="tooShort" class="py-12 text-center text-sm text-ink-gray-5">
      {{ __('Type to search') }}
    </div>
    <div v-else class="py-12 text-center text-sm text-ink-gray-5">
      {{ __('No results for') }} “{{ query.trim() }}”
    </div>
  </div>
</template>

<script setup>
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import { isMobileView } from '@/composables/settings'
import { escapeHTML, escapeRegExp } from '@/utils'
import { Badge, LoadingIndicator } from 'frappe-ui'

// One color fixture, static classes (Tailwind JIT can't scan template literals), matching the Badge subtle
// themes so tiles and badges read as one system: Lead=blue, Note=green, File=amber.
const TYPE = {
  'CRM Lead': { icon: LeadsIcon, tile: 'bg-surface-blue-2 text-ink-blue-1' },
  'FCRM Note': { icon: NoteIcon, tile: 'bg-surface-green-3 text-ink-green-1' },
  File: { icon: AttachmentIcon, tile: 'bg-surface-amber-2 text-ink-amber-1' },
}

const props = defineProps({
  hits: { type: Array, default: () => [] },
  selected: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  tooShort: { type: Boolean, default: true },
  query: { type: String, default: '' },
})
defineEmits(['select', 'hover'])

// Drop the framework's whole-token <mark> so it can't reach the DOM as escaped text.
const stripMark = (s) => (s || '').replace(/<\/?mark>/g, '')

// Light up only the typed characters (not the whole matched token).
function highlight(text) {
  const escaped = escapeHTML(stripMark(text))
  const term = props.query.trim()
  if (!term) return escaped
  return escaped.replace(new RegExp(`(${escapeRegExp(term)})`, 'ig'), '<mark>$1</mark>')
}

const leadMeta = (h) => [h.phone, h.vertical, h.group].filter(Boolean).join(' · ')
</script>

<style scoped>
/* Match highlight — a yellow wash (Frappe amber token) that keeps the text's own readable colour. */
:deep(mark) {
  border-radius: 3px;
  background-color: var(--surface-amber-2);
  padding: 0 2px;
  color: inherit;
}
</style>
