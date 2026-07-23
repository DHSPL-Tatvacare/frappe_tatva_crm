<!-- eslint-disable vue/no-v-html -->
<!-- TATVA: spotlight result rows — one source of truth. Compact single-line on desktop, a roomier
     stacked card on mobile. Results stay put while a new query loads (no bounce). -->
<template>
  <div class="min-h-[8rem]">
    <!-- Rows persist during a reload, so the list never collapses to a spinner mid-type. -->
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
          <Avatar :label="strip(hit.title)" :size="isMobileView ? 'xl' : 'lg'" class="mt-0.5 shrink-0" />
          <div class="min-w-0 flex-1">
            <!-- Line 1: name + status. -->
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-ink-gray-9" v-html="highlight(hit.title)" />
              <Badge v-if="hit.status" :label="hit.status" theme="blue" variant="subtle" size="sm" class="shrink-0" />
            </div>
            <!-- Line 2: lead meta, or the match snippet. -->
            <div v-if="hit.doctype === 'CRM Lead'" class="mt-0.5 truncate text-xs text-ink-gray-5">
              {{ leadMeta(hit) }}
            </div>
            <div v-else class="mt-0.5 truncate text-xs text-ink-gray-5" v-html="highlight(hit.snippet)" />
            <!-- Line 3 (mobile only): assignee sits under the row instead of crowding the right edge. -->
            <Badge
              v-if="isMobileView && hit.assignee"
              :label="hit.assignee"
              theme="green"
              variant="subtle"
              size="sm"
              class="mt-1.5"
            />
          </div>
          <!-- Desktop: assignee + type on the right. -->
          <div v-if="!isMobileView" class="flex shrink-0 flex-col items-end gap-1">
            <Badge v-if="hit.assignee" :label="hit.assignee" theme="green" variant="subtle" size="sm" />
            <span class="text-xs text-ink-gray-4">{{ labelFor(hit.doctype) }}</span>
          </div>
          <span v-else class="mt-0.5 shrink-0 text-xs text-ink-gray-4">{{ labelFor(hit.doctype) }}</span>
        </button>
      </li>
    </ul>

    <!-- Empty states — only when there are no rows to keep on screen. -->
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
import { isMobileView } from '@/composables/settings'
import { Avatar, Badge, LoadingIndicator } from 'frappe-ui'

const props = defineProps({
  hits: { type: Array, default: () => [] },
  selected: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  tooShort: { type: Boolean, default: true },
  query: { type: String, default: '' },
})
defineEmits(['select', 'hover'])

const LABELS = { 'CRM Lead': 'Lead', 'FCRM Note': 'Note', File: 'File' }
const HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
// The backend wraps whole matched tokens in <mark>; strip them for the avatar's initials.
const strip = (s) => (s || '').replace(/<\/?mark>/g, '')
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => HTML[c])
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Light up only the typed characters (not the whole token): drop the FTS marks, escape, then wrap the query.
function highlight(text) {
  const escaped = escapeHtml(strip(text))
  const term = props.query.trim()
  if (!term) return escaped
  return escaped.replace(new RegExp(`(${escapeRegex(term)})`, 'ig'), '<mark>$1</mark>')
}

const leadMeta = (h) => [h.phone, h.vertical, h.group].filter(Boolean).join(' · ')
const labelFor = (dt) => __(LABELS[dt] || '')
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
