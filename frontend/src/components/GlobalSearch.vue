<!--
  TATVA: ⌘K / tap spotlight. One container over two shared device shells:
    · desktop → TatvaSpotlight (top overlay)   · mobile → TatvaBottomSheet
  Mounted once in GlobalModals (both layouts); opened via the shared showGlobalSearch ref.
-->
<template>
  <!-- MOBILE: native bottom sheet. -->
  <!-- TATVA: `snap`, not the default `fit`. Results ARRIVE as the rep types, and a content-sized sheet
       grows with them — it opened as a sliver and shot to full height mid-keystroke. Snapped, it rests at
       a readable size, the results scroll inside it, and the handle drags it taller when wanted. -->
  <!-- Sized for the KEYBOARD, which is up from the first frame here because the input autofocuses: the
       sheet's top is pinned and the keyboard eats the bottom, so 0.6 left ~170px of results. 0.85 leaves
       ~380px, about four rows, and the top edge still never moves. -->
  <TatvaBottomSheet
    v-if="isMobileView"
    v-model="showGlobalSearch"
    :title="__('Search')"
    mode="snap"
    :collapsed="0.85"
    :expanded="0.9"
  >
    <template #header>
      <div class="flex flex-1 flex-col">
        <div class="flex items-center gap-2">
          <FeatherIcon name="search" class="h-4 w-4 shrink-0 text-ink-gray-4" />
          <input
            ref="inputRef"
            v-model="query"
            :placeholder="__('Search leads, notes, files')"
            class="flex-1 border-0 bg-transparent text-base text-ink-gray-9 placeholder:text-ink-gray-4 focus:!border-0 focus:!shadow-none focus:!outline-none focus:!ring-0"
          />
        </div>
        <SearchInterpretation :understood="understood" class="mt-1 pl-6" />
      </div>
    </template>
    <SearchResults v-bind="resultsProps" @select="open" @hover="(i) => (selected = i)" />
  </TatvaBottomSheet>

  <!-- DESKTOP: top spotlight overlay. -->
  <TatvaSpotlight v-else v-model="showGlobalSearch">
    <template #header>
      <div class="px-4 py-3">
        <div class="flex items-center gap-3">
          <FeatherIcon name="search" class="h-5 w-5 shrink-0 text-ink-gray-4" />
          <input
            ref="inputRef"
            v-model="query"
            :placeholder="__('Search leads, notes, files')"
            class="flex-1 border-0 bg-transparent text-base text-ink-gray-9 placeholder:text-ink-gray-4 focus:!border-0 focus:!shadow-none focus:!outline-none focus:!ring-0"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="openSelected"
          />
          <kbd class="rounded bg-surface-gray-2 px-2 py-1 font-sans text-xs text-ink-gray-4">ESC</kbd>
        </div>
        <SearchInterpretation :understood="understood" class="mt-1.5 pl-8" />
      </div>
    </template>
    <SearchResults v-bind="resultsProps" @select="open" @hover="(i) => (selected = i)" />
    <template #footer>
      <div class="flex items-center justify-between px-4 py-2 text-xs text-ink-gray-5">
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
        <!-- The index caps its own result set, so a plateaued count is a floor: say `100+`, never a false exact. -->
        <span v-if="payload?.total">
          {{ payload.total }}{{ payload.total_capped ? '+' : '' }} {{ __('results') }}
        </span>
      </div>
    </template>
  </TatvaSpotlight>
</template>

<script setup>
import SearchInterpretation from '@/components/SearchInterpretation.vue'
import SearchResults from '@/components/SearchResults.vue'
import { isMobileView, showGlobalSearch } from '@/composables/settings'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import TatvaBottomSheet from '@/tatva/TatvaBottomSheet.vue'
import TatvaSpotlight from '@/tatva/TatvaSpotlight.vue'
import { createResource, FeatherIcon } from 'frappe-ui'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const inputRef = ref(null)
const query = ref('')
const selected = ref(0)

// The panel renders from THIS, never from results.data: createResource assigns out.data unconditionally, so a
// slow answer for "ab" landing after a fast "abc" replaced the right list with the wrong one while the box read
// "abc". Only a response whose generation is still current may write here. out.params can't decide it — it is
// overwritten when the NEXT fetch starts, long before the earlier one resolves.
const payload = ref(null)
let generation = 0
let timer = null

// One endpoint, never eager: auto:false means no round-trip on mount. The 250ms wait is OURS rather than the
// resource's `debounce` because frappe-ui's debounce exposes no cancel, and a close or a cleared box must
// cancel — the same owned-timer pattern NodeInspector.vue uses for the same reason.
const results = createResource({
  url: 'tatva_connect.search.api.search',
  auto: false,
  makeParams: () => ({ query: query.value.trim(), limit: 20 }),
})

// The generation is taken at REQUEST time and compared inside the per-submit onSuccess, so a stale answer returns.
function ask() {
  const mine = ++generation
  results.submit(null, {
    onSuccess: (data) => {
      if (mine !== generation) return
      payload.value = data
      selected.value = 0
    },
  })
}

// Cancels the armed request AND retires every in-flight one, so nothing pending can paint into a closed or emptied panel.
function cancel() {
  clearTimeout(timer)
  timer = null
  generation++
  payload.value = null
  results.reset()
}

const hits = computed(() => payload.value?.results || [])
// The server's own reading — ready / too_short / building / disabled — so an empty list always says WHY.
// No minimum length lives here: the endpoint owns that rule, or the two would drift and swallow a valid search.
const status = computed(() => payload.value?.status || '')
// The server's reading of the WORDS: absent whenever the split resolved nothing, so the line simply isn't drawn.
const understood = computed(() => payload.value?.understood || null)

// ONE prop block for both device shells: the two copies of it drifted once already.
const resultsProps = computed(() => ({
  hits: hits.value,
  selected: selected.value,
  loading: results.loading,
  query: query.value,
  status: status.value,
}))

// Anything typed goes to the server, which decides whether it is long enough; an empty box asks nothing and cancels.
watch(query, () => {
  selected.value = 0
  clearTimeout(timer)
  if (!query.value.trim()) return cancel()
  timer = setTimeout(ask, 250)
})

// Reset + focus on open; a close cancels whatever was armed or in flight, in the same one watcher.
watch(showGlobalSearch, (open) => {
  query.value = ''
  cancel()
  if (open) nextTick(() => inputRef.value?.focus())
})

onBeforeUnmount(() => clearTimeout(timer))

// A modal Dialog puts `pointer-events: none` on the body (reka-ui DismissableLayer), so a spotlight opened over
// one paints on top and is completely inert. isDialogOpen() only knows programmatic dialogs, so ask the DOM:
// reka marks its open content `[role=dialog][data-state=open]`, which our own panels never carry.
const modalOpen = () => !!document.querySelector('[role="dialog"][data-state="open"]')

// ⌘K / Ctrl+K toggles from anywhere (desktop); mobile opens via the sidebar Search item. The guard, not the
// action, does the no-op so a swallowed keypress never eats the browser's own ⌘K while a Dialog owns the screen.
useKeyboardShortcuts({
  ignoreTyping: false,
  skipWhenDialogOpen: false,
  shortcuts: [
    {
      match: (e) => (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k',
      guard: () => showGlobalSearch.value || !modalOpen(),
      action: () => (showGlobalSearch.value = !showGlobalSearch.value),
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
    // noopener: without it the opened document keeps a live window handle back into the CRM tab.
    if (hit.file_url) window.open(hit.file_url, '_blank', 'noopener')
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
