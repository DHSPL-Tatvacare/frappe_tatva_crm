<!--
  TATVA: ⌘K / tap spotlight. ONE shell everywhere — the top overlay, phone and desktop alike.
  Mounted once in GlobalModals (both layouts); opened via the shared showGlobalSearch ref.
  What is typed, asked and shown is `useSpotlight`; this file is the panel, the keyboard and the route.
-->
<template>
  <TatvaSpotlight v-model="showGlobalSearch">
    <template #header>
      <div class="px-4 py-3">
        <div class="flex items-center gap-3">
          <FeatherIcon name="search" class="h-5 w-5 shrink-0 text-ink-gray-4" />
          <input
            ref="inputRef"
            v-model="query"
            :placeholder="__('Search leads, files and shortcuts')"
            class="flex-1 border-0 bg-transparent text-base text-ink-gray-9 placeholder:text-ink-gray-4 focus:!border-0 focus:!shadow-none focus:!outline-none focus:!ring-0"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="openSelected"
          />
          <kbd class="rounded bg-surface-gray-2 px-2 py-1 font-sans text-xs text-ink-gray-4">ESC</kbd>
        </div>
        <SearchInterpretation :understood="understood" class="mt-1.5 pl-8" />
            <!-- Capture, because the RadioGroup stops ArrowUp/Down at itself: the list keeps those keys. -->
        <!-- The strip scrolls rather than overflows: the tab count is dynamic and a phone is 390px. -->
        <div class="mt-2.5 flex overflow-x-auto pl-8" @keydown.capture="fromTabs">
          <div class="shrink-0"><TabButtons v-model="tab" :buttons="tabs" /></div>
        </div>
      </div>
    </template>
    <SearchResults
      :hits="rows"
      :selected="selected"
      :loading="loading"
      :query="query"
      :status="status"
      :tab="tab"
      :totals="totals"
      @select="open"
      @hover="(i) => (selected = i)"
    />
    <template #footer>
      <div class="flex items-center justify-between px-4 py-2 text-xs text-ink-gray-5">
        <!-- A phone has none of these keys, so the hints are desktop-only rather than decoration. -->
        <div class="hidden items-center gap-4 sm:flex">
          <span class="flex items-center gap-1">
            <kbd class="rounded bg-surface-gray-3 px-1.5 py-0.5 text-ink-gray-6">↵</kbd>
            {{ __('to select') }}
          </span>
          <span class="flex items-center gap-1">
            <kbd class="rounded bg-surface-gray-3 px-1.5 py-0.5 text-ink-gray-6">↑↓</kbd>
            {{ __('to navigate') }}
          </span>
          <!-- The strip is a RadioGroup: one tab stop, arrows switch. Nothing is bound — only said. -->
          <span class="flex items-center gap-1">
            <kbd class="rounded bg-surface-gray-3 px-1.5 py-0.5 text-ink-gray-6">⇥</kbd>
            {{ __('then') }}
            <kbd class="rounded bg-surface-gray-3 px-1.5 py-0.5 text-ink-gray-6">←→</kbd>
            {{ __('for tabs') }}
          </span>
        </div>
        <!-- The index caps its own result set, so a plateaued count is a floor: say `100+`, never a false exact. -->
        <!-- ml-auto, not justify-between: with the hints hidden the count is the only child on a phone. -->
        <span v-if="total" class="ml-auto">{{ total }}{{ totalCapped ? '+' : '' }} {{ __('results') }}</span>
      </div>
    </template>
  </TatvaSpotlight>
</template>

<script setup>
import SearchInterpretation from '@/components/SearchInterpretation.vue'
import SearchResults from '@/components/SearchResults.vue'
import { showGlobalSearch } from '@/composables/settings'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { FILE, useSpotlight } from '@/composables/useSpotlight'
import TatvaSpotlight from '@/tatva/TatvaSpotlight.vue'
import { FeatherIcon, TabButtons } from 'frappe-ui'
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const inputRef = ref(null)

const {
  query,
  tab,
  tabs,
  selected,
  rows,
  remember,
  expand,
  loading,
  status,
  understood,
  total,
  totals,
  totalCapped,
} = useSpotlight()

watch(showGlobalSearch, (open) => {
  if (open) nextTick(() => inputRef.value?.focus())
})

// A reka Dialog makes the body inert, and isDialogOpen() misses it, so ask the DOM for its open content.
const modalOpen = () => !!document.querySelector('[role="dialog"][data-state="open"]')

// The GUARD no-ops, not the action, so a swallowed ⌘K never eats the browser's while a Dialog is open.
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

// The list owns Up, Down and Enter from ANYWHERE in the panel; the tab strip owns only Left and Right.
function fromTabs(e) {
  const list = { ArrowDown: () => move(1), ArrowUp: () => move(-1), Enter: openSelected }[e.key]
  if (!list) return
  e.preventDefault()
  e.stopPropagation()
  inputRef.value?.focus()
  list()
}

function move(delta) {
  const n = rows.value.length
  if (!n) return
  selected.value = (selected.value + delta + n) % n
}

function openSelected() {
  const row = rows.value[selected.value]
  if (row) open(row)
}

// THE one door every row leaves by, so a recent, a live hit and a shortcut cannot route three ways.
function open(row) {
  // A view change, not a navigation: a server-made cut opens its tab, ours expands where it stands.
  if (row.isMore) return row.tab ? (tab.value = row.tab) : expand(row.group)
  remember(row)
  close()
  if (row.isShortcut) return openShortcut(row)
  // A File opens its Azure-proxied bytes in a new tab; everything else routes to the lead + tab hash.
  if (row.doctype === FILE) {
    // noopener: without it the opened document keeps a live window handle back into the CRM tab.
    if (row.file_url) window.open(row.file_url, '_blank', 'noopener')
    else if (row.lead) goToLead(row.lead, 'attachments')
    return
  }
  // TATVA: a Deal is not a child of a lead — it is a second record about the same person, so it opens itself.
  if (row.doctype === 'CRM Deal') {
    if (row.name) router.push({ name: 'Deal', params: { dealId: row.name } })
    return
  }
  goToLead(row.lead, row.tab)
}

// A shortcut carries the target the SERVER resolved: a router target here, a path for a Desk page.
function openShortcut(shortcut) {
  if (shortcut.external) window.open(shortcut.route, '_blank', 'noopener')
  else if (shortcut.route) router.push(shortcut.route)
}

function goToLead(leadId, tab) {
  if (!leadId) return
  router.push({ name: 'Lead', params: { leadId }, hash: tab ? '#' + tab : undefined })
}
</script>

<style scoped>
/* The focusable element is the RadioGroup's option div, which carries no ring of its own — so the browser
   paints its default, and on macOS that follows the system accent. Recolour it; never remove it. */
:deep([role='radio']:focus-visible) {
  outline-color: var(--outline-gray-3);
}
</style>
