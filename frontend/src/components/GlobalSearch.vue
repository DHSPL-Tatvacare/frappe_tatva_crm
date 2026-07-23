<!--
  TATVA: ⌘K / tap spotlight. One container, two device shells sharing SearchResults:
    · desktop  → a Wiki-style top overlay
    · mobile   → the native TatvaBottomSheet (drag, scroll-lock, keyboard-safe)
  Mounted once in GlobalModals (rendered by both layouts); opened via the shared showGlobalSearch ref.
-->
<template>
  <!-- MOBILE: native bottom sheet. -->
  <TatvaBottomSheet v-if="isMobileView" v-model="showGlobalSearch" :title="__('Search')">
    <template #header>
      <div class="flex flex-1 items-center gap-2">
        <FeatherIcon name="search" class="h-4 w-4 shrink-0 text-ink-gray-4" />
        <input
          ref="inputRef"
          v-model="query"
          :placeholder="__('Search leads, notes, files')"
          class="flex-1 border-0 bg-transparent text-base text-ink-gray-9 placeholder:text-ink-gray-4 focus:!border-0 focus:!shadow-none focus:!outline-none focus:!ring-0"
        />
      </div>
    </template>
    <SearchResults
      :hits="hits"
      :selected="selected"
      :loading="results.loading"
      :too-short="tooShort"
      :query="query"
      @select="open"
      @hover="(i) => (selected = i)"
    />
  </TatvaBottomSheet>

  <!-- DESKTOP: top spotlight overlay. -->
  <Teleport v-else to="body">
    <Transition name="gs">
      <div v-if="showGlobalSearch" class="relative z-50">
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" @click="close" />
        <div class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[20vh]" @click.self="close">
          <div class="gs-modal w-full max-w-2xl overflow-hidden rounded-xl border border-outline-gray-1 bg-surface-white shadow-2xl">
            <div class="flex items-center gap-3 border-b border-outline-gray-1 px-4 py-3">
              <FeatherIcon name="search" class="h-5 w-5 shrink-0 text-ink-gray-4" />
              <input
                ref="inputRef"
                v-model="query"
                :placeholder="__('Search leads, notes, files')"
                class="flex-1 border-0 bg-transparent text-base text-ink-gray-9 placeholder:text-ink-gray-4 focus:!border-0 focus:!shadow-none focus:!outline-none focus:!ring-0"
                @keydown.down.prevent="move(1)"
                @keydown.up.prevent="move(-1)"
                @keydown.enter.prevent="openSelected"
                @keydown.esc.prevent="close"
              />
              <kbd class="rounded bg-surface-gray-2 px-2 py-1 font-sans text-xs text-ink-gray-4">ESC</kbd>
            </div>

            <FadedScrollableDiv class="max-h-[60vh] overflow-y-auto py-1.5">
              <SearchResults
                :hits="hits"
                :selected="selected"
                :loading="results.loading"
                :too-short="tooShort"
                :query="query"
                @select="open"
                @hover="(i) => (selected = i)"
              />
            </FadedScrollableDiv>

            <div class="flex items-center justify-between border-t border-outline-gray-1 bg-surface-gray-1 px-4 py-2 text-xs text-ink-gray-5">
              <div class="flex items-center gap-4">
                <span class="flex items-center gap-1">
                  <kbd class="rounded bg-surface-gray-3 px-1.5 py-0.5 text-ink-gray-6">↵</kbd>
                  {{ __('to select') }}
                </span>
                <span class="flex items-center gap-1">
                  <kbd class="rounded bg-surface-gray-3 px-1.5 py-0.5 text-ink-gray-6">↑↓</kbd>
                  {{ __('to navigate') }}
                </span>
              </div>
              <span v-if="results.data?.total">{{ results.data.total }} {{ __('results') }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import SearchResults from '@/components/SearchResults.vue'
import { isMobileView, showGlobalSearch } from '@/composables/settings'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import TatvaBottomSheet from '@/tatva/TatvaBottomSheet.vue'
import { useDebounceFn } from '@vueuse/core'
import { createResource, FeatherIcon } from 'frappe-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const MIN = 3
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

// ⌘K / Ctrl+K opens from anywhere (desktop); mobile opens via the header search button.
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

function close() {
  showGlobalSearch.value = false
}

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
  close()
  // A File opens its Azure-proxied bytes in a new tab; everything else routes to the lead + tab hash.
  if (hit.doctype === 'File') {
    if (hit.file_url) window.open(hit.file_url, '_blank')
    else if (hit.lead) goToLead(hit.lead, 'attachments')
    return
  }
  goToLead(hit.lead, hit.tab)
}

function goToLead(leadId, tab) {
  if (!leadId) return
  router.push({ name: 'Lead', params: { leadId }, hash: tab ? '#' + tab : undefined })
}
</script>

<style scoped>
/* Smooth open/close — fade the backdrop, lift the panel slightly (Wiki's feel). Desktop only. */
.gs-enter-active,
.gs-leave-active {
  transition: opacity 0.2s ease;
}
.gs-enter-from,
.gs-leave-to {
  opacity: 0;
}
.gs-enter-active .gs-modal,
.gs-leave-active .gs-modal {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.gs-enter-from .gs-modal,
.gs-leave-to .gs-modal {
  transform: scale(0.97) translateY(-16px);
  opacity: 0;
}
</style>
