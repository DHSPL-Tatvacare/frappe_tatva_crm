<!-- eslint-disable vue/no-v-html -->
<!--
  TATVA: Global spotlight search (⌘K). One frappe-ui Dialog, mounted once by AppSidebar. It calls ONE
  backend endpoint (tatva_connect.search.api.search) and renders its shape — no filtering, ranking,
  visibility or highlight logic lives here. Snippets are backend-generated plain text + <mark>.
  Navigation is the native lead route + tab hash; a File opens its Azure-proxied file_url in a new tab.
-->
<template>
  <Dialog v-model="showGlobalSearch" :options="{ size: '3xl' }">
    <template #body>
      <div class="flex flex-col bg-surface-modal">
        <!-- Search input -->
        <div
          class="flex items-center gap-3 border-b border-outline-gray-1 px-4 py-3"
        >
          <FeatherIcon name="search" class="size-4 shrink-0 text-ink-gray-5" />
          <input
            ref="inputRef"
            v-model="query"
            :placeholder="__('Search leads, notes, tasks, calls, files')"
            class="flex-1 bg-transparent text-base text-ink-gray-9 outline-none placeholder:text-ink-gray-4"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="openSelected"
          />
          <kbd
            class="rounded bg-surface-gray-2 px-2 py-1 text-xs text-ink-gray-4"
            >ESC</kbd
          >
        </div>

        <!-- Results -->
        <div class="max-h-[60vh] min-h-[8rem] overflow-y-auto">
          <div
            v-if="results.loading"
            class="flex items-center justify-center py-12 text-ink-gray-5"
          >
            <LoadingIndicator class="size-5" />
          </div>
          <div
            v-else-if="tooShort"
            class="py-12 text-center text-sm text-ink-gray-5"
          >
            {{ __('Type to search') }}
          </div>
          <div
            v-else-if="!hits.length"
            class="py-12 text-center text-sm text-ink-gray-5"
          >
            {{ __('No results for') }} “{{ query.trim() }}”
          </div>
          <ul v-else class="py-1.5">
            <li v-for="(hit, i) in hits" :key="hit.doctype + ':' + hit.name">
              <button
                class="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                :class="i === selected ? 'bg-surface-gray-2' : ''"
                @click="open(hit)"
                @mouseenter="selected = i"
              >
                <FeatherIcon
                  :name="iconFor(hit.doctype)"
                  class="size-4 shrink-0 text-ink-gray-5"
                />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-ink-gray-9">
                    {{ hit.title }}
                  </div>
                  <div
                    v-if="hit.doctype === 'CRM Lead'"
                    class="truncate text-xs text-ink-gray-5"
                  >
                    {{ leadMeta(hit) }}
                  </div>
                  <div
                    v-else
                    class="truncate text-xs text-ink-gray-5"
                    v-html="hit.snippet"
                  />
                </div>
                <span class="shrink-0 text-xs text-ink-gray-4">
                  {{ labelFor(hit.doctype) }}
                </span>
              </button>
            </li>
          </ul>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-between border-t border-outline-gray-1 bg-surface-gray-1 px-4 py-2 text-xs text-ink-gray-5"
        >
          <div class="flex items-center gap-4">
            <span class="flex items-center gap-1">
              <kbd class="rounded bg-surface-gray-3 px-1.5 py-0.5">↵</kbd>
              {{ __('to select') }}
            </span>
            <span class="flex items-center gap-1">
              <kbd class="rounded bg-surface-gray-3 px-1.5 py-0.5">↑↓</kbd>
              {{ __('to navigate') }}
            </span>
          </div>
          <span v-if="results.data?.total">{{ results.data.total }}</span>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { showGlobalSearch } from '@/composables/settings'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useDebounceFn } from '@vueuse/core'
import { createResource, Dialog, FeatherIcon, LoadingIndicator } from 'frappe-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const MIN = 3
const ICONS = {
  'CRM Lead': 'user',
  'FCRM Note': 'file-text',
  'CRM Task': 'check-square',
  'CRM Call Log': 'phone',
  File: 'paperclip',
}
const LABELS = {
  'CRM Lead': 'Lead',
  'FCRM Note': 'Note',
  'CRM Task': 'Task',
  'CRM Call Log': 'Call',
  File: 'File',
}

const router = useRouter()
const inputRef = ref(null)
const query = ref('')
const selected = ref(0)

// One endpoint, never eager: auto:false + the length floor mean no round-trip on mount or for <3 chars.
const results = createResource({
  url: 'tatva_connect.search.api.search',
  auto: false,
  makeParams: () => ({ query: query.value.trim(), limit: 20 }),
  onSuccess: () => (selected.value = 0),
})

const tooShort = computed(() => query.value.trim().length < MIN)
const hits = computed(() => results.data?.results || [])

const runSearch = useDebounceFn(() => {
  if (!tooShort.value) results.submit()
}, 250)

watch(query, () => {
  selected.value = 0
  if (tooShort.value) results.reset()
  else runSearch()
})

// Reset + focus each time the spotlight opens.
watch(showGlobalSearch, (open) => {
  if (!open) return
  query.value = ''
  results.reset()
  nextTick(() => inputRef.value?.focus())
})

// ⌘K / Ctrl+K opens from anywhere, including while typing in another field.
useKeyboardShortcuts({
  ignoreTyping: false,
  skipWhenDialogOpen: false,
  shortcuts: [
    {
      match: (e) => (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k',
      action: () => (showGlobalSearch.value = true),
    },
  ],
})

function move(delta) {
  const n = hits.value.length
  if (!n) return
  selected.value = (selected.value + delta + n) % n
}

function openSelected() {
  const hit = hits.value[selected.value]
  if (hit) open(hit)
}

function open(hit) {
  showGlobalSearch.value = false
  if (hit.doctype === 'File') {
    if (hit.file_url) window.open(hit.file_url, '_blank')
    else if (hit.lead) goToLead(hit.lead, 'attachments')
    return
  }
  goToLead(hit.lead, hit.tab)
}

function goToLead(leadId, tab) {
  if (!leadId) return
  router.push({
    name: 'Lead',
    params: { leadId },
    hash: tab ? '#' + tab : undefined,
  })
}

function leadMeta(hit) {
  return [hit.phone, hit.vertical, hit.group].filter(Boolean).join(' · ')
}

const iconFor = (dt) => ICONS[dt] || 'search'
const labelFor = (dt) => __(LABELS[dt] || '')
</script>
