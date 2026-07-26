<!-- eslint-disable vue/no-v-html -->
<!-- TATVA: spotlight result rows — one source of truth. Compact on desktop, roomier on mobile.
     Rows persist during a reload (no bounce); the server's own <mark> is what is highlighted. -->
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
              <span class="truncate text-sm font-medium text-ink-gray-9" v-html="marked(hit.title)" />
              <Badge v-if="hit.status" :label="hit.status" theme="blue" variant="subtle" size="sm" class="shrink-0" />
            </div>
            <!-- A lead's own line: four fixed slots, then the ID slot when the server says one was typed.
                 Plain interpolation — a metadata value is never markup, and the mark wraps a WHOLE value. -->
            <div v-if="hit.doctype === 'CRM Lead'" class="mt-0.5 line-clamp-2 text-xs text-ink-gray-5">
              <span v-for="(slot, k) in slotsOf(hit)" :key="k">
                <span v-if="k" aria-hidden="true">&nbsp;·&nbsp;</span>
                <span v-if="slot.label" class="text-ink-gray-4">{{ __(slot.label) }}:&nbsp;</span>
                <mark v-if="slot.marked">{{ slot.value }}</mark>
                <template v-else>{{ slot.value }}</template>
              </span>
            </div>
            <div v-else class="mt-0.5 line-clamp-2 text-xs text-ink-gray-5" v-html="marked(hit.snippet)" />
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
    <!-- Nothing asked yet, or the server says too little was typed. It owns that rule; this only renders it. -->
    <div v-else-if="!status || status === 'too_short'" class="py-12 text-center text-sm text-ink-gray-5">
      {{ __('Type to search') }}
    </div>
    <!-- An index that is absent or mid-build is not a no-match; saying "No results" reads as a broken search. -->
    <div v-else-if="status === 'building'" class="py-12 text-center text-sm text-ink-gray-5">
      {{ __('Search is still being prepared. Results will appear shortly.') }}
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
import { sanitizeHTML } from '@/utils'
import { Badge, LoadingIndicator } from 'frappe-ui'

// One color fixture, static classes (Tailwind JIT can't scan template literals). Same pairing rule as the
// Badge subtle themes — a tint surface under its own hue's saturated ink — so tiles and badges read as one
// system in both themes. Never an `ink-*-1`: that is the on-solid-fill ink, near-white on light and dark alike.
const TYPE = {
  'CRM Lead': { icon: LeadsIcon, tile: 'bg-surface-blue-2 text-ink-blue-2' },
  'FCRM Note': { icon: NoteIcon, tile: 'bg-surface-green-2 text-ink-green-3' },
  File: { icon: AttachmentIcon, tile: 'bg-surface-amber-2 text-ink-amber-3' },
}

defineProps({
  hits: { type: Array, default: () => [] },
  selected: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  query: { type: String, default: '' },
  // The endpoint's own reading: 'ready' | 'too_short' | 'building' | 'disabled'. It owns the query floor.
  status: { type: String, default: '' },
})
defineEmits(['select', 'hover'])

// Render what FTS5 really matched. highlight()/snippet() already wrapped it server-side, including the prefix
// hits and spelling expansions a client regex on the typed term cannot reproduce ("rames" marks "Ramesh").
// Only <mark> survives: `content` carries user-entered note text.
const marked = (html) => sanitizeHTML(html || '', { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] })

// Four fixed slots, always in this order, then ONE dynamic slot: the unique ID the server says was typed. A
// unique ID is INPUT — it is shown here and nowhere else, whole, so no fragment of one can ever render.
function slotsOf(h) {
  const ident = h.ident || null
  const slots = [
    // Phone is already a fixed slot, so a phone match marks that slot in place rather than repeating the number.
    { value: h.phone, marked: ident?.column === 'phone' },
    { value: h.vertical },
    { value: h.group },
    { value: h.program },
  ].filter((s) => s.value)
  if (ident && ident.column !== 'phone') slots.push({ label: ident.label, value: ident.value, marked: true })
  return slots
}
</script>

<style scoped>
/* Match highlight — a yellow wash (Frappe amber token) that keeps the text's own readable colour. Background
   and inherited line-height only: padding, a radius or a margin would visually split a marked run out of its
   own word, which is what made a prefix match read as broken. Overflow is line-clamped, never cut mid-token. */
:deep(mark) {
  background-color: var(--surface-amber-2);
  color: inherit;
}
</style>
