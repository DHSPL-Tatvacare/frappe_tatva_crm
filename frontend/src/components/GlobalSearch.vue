<!-- TATVA: the ⌘K command palette, Helpdesk's CommandPalette.vue on the same reka Dialog; mounted once in GlobalModals, and its state is tatva/palette/usePalette.js. -->
<template>
  <DialogRoot :open="isOpen" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="palette-overlay fixed inset-0 z-50 bg-black/30 dark:bg-black/60" />
      <DialogContent
        class="palette-content fixed left-1/2 top-[10%] z-50 w-[calc(100%-2rem)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-md bg-surface-white shadow-2xl ring-1 ring-black/[0.06] focus-visible:outline-none dark:ring-white/[0.08]"
        @open-auto-focus.prevent
        @close-auto-focus.prevent="restoreFocus"
        @escape-key-down.prevent="onEscape"
        @keydown="onKeydown"
      >
        <DialogTitle class="sr-only">{{ __('Command Palette') }}</DialogTitle>

        <!-- Collapses to zero height on dismiss, so the input glides up. -->
        <Transition name="chip">
          <div v-if="context" class="chip-row grid">
            <div class="overflow-hidden">
              <!-- Not a button: removal is backspace-only, advertised by esc's label. -->
              <Badge class="chip mx-4 mt-3 max-w-[60%]">
                <span class="shrink-0 text-ink-gray-7">{{ context.label }}</span>
                <span class="shrink-0 text-ink-gray-4">⋅</span>
                <span class="truncate leading-snug text-ink-gray-5">{{ context.title }}</span>
              </Badge>
            </div>
          </div>
        </Transition>

        <!-- px-2 + the input's own padding put the glass on the row icons' axis, and the caret on their titles'. -->
        <div ref="inputWrapperRef" class="border-b border-outline-gray-1 px-2 py-2">
          <div class="flex items-center">
            <button
              v-if="stepLabel"
              type="button"
              class="ms-2 flex shrink-0 items-center gap-2 py-1 text-base font-medium text-ink-gray-7"
              @click="back"
            >
              {{ stepLabel }}
              <LucideChevronRight class="size-3 text-ink-gray-4" />
            </button>
            <TextInput
              type="text"
              :model-value="query"
              :placeholder="placeholder"
              variant="ghost"
              size="sm"
              class="w-full"
              spellcheck="false"
              :aria-label="context ? __('Search commands for {0}', [context.title]) : __('Search commands')"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-list"
              :aria-activedescendant="activeOptionId"
              @update:model-value="onQueryChange"
            >
              <template #prefix>
                <LucideSearch class="size-3.5 shrink-0 text-ink-gray-4" />
              </template>
            </TextInput>
          </div>
          <!-- The server's own reading of the words, when it resolved any into filters. -->
          <SearchInterpretation :understood="searchResponse?.understood || null" class="px-2 pb-1 pt-0.5" />
          <!-- TATVA: the query builder's conditions and the list's own count of what they match; ⌫ on an empty input removes the last. -->
          <div v-if="inQuery" class="flex items-start gap-3 px-2 pb-1 pt-1.5">
            <div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
              <Badge v-for="(condition, index) in conditions" :key="index" class="max-w-full">
                <span class="truncate text-ink-gray-7">{{ condition.label }}</span>
                <button type="button" class="ms-1 shrink-0 text-ink-gray-4 hover:text-ink-gray-7" :aria-label="__('Remove')" @click="removeCondition(index)">
                  <LucideX class="size-3" />
                </button>
              </Badge>
              <span v-if="!conditions.length" class="text-sm text-ink-gray-4">{{ __('Pick a field to add a condition') }}</span>
            </div>
            <span class="shrink-0 text-sm tabular-nums" :class="countError ? 'text-ink-red-4' : 'text-ink-gray-5'">{{ countLabel }}</span>
          </div>
        </div>

        <!-- Announces what no row can: result count, and list changes under debounce. -->
        <div class="sr-only" aria-live="polite">{{ resultAnnouncement }}</div>

        <div
          id="command-palette-list"
          ref="listRef"
          role="listbox"
          class="relative max-h-[min(380px,60svh)] min-h-[7rem] overflow-y-auto overscroll-contain py-2"
        >
          <div v-if="isLoading" class="palette-progress absolute inset-x-0 top-0 h-0.5 bg-surface-gray-4" />
          <!-- Keyed by level: drill in/out fades, typing never re-keys. -->
          <Transition name="level" mode="out-in">
            <div :key="levelKey">
              <template v-if="flatItems.length">
                <div
                  v-for="(group, groupIndex) in renderGroups"
                  :key="`${groupIndex}:${group.title}`"
                  role="group"
                  :aria-label="group.title || __('Lead')"
                >
                  <div v-if="group.title" class="px-4 pb-1 pt-2 text-xs font-medium text-ink-gray-4">
                    {{ group.title }}
                  </div>
                  <div
                    v-for="row in group.items"
                    :id="optionId(row.index)"
                    :key="`${group.title}:${row.command.id}`"
                    role="option"
                    :aria-selected="row.index === activeIndex"
                    class="cursor-pointer px-2"
                    :data-active="row.index === activeIndex"
                    @mousemove="onRowHover(row.index)"
                    @click="run(row.command)"
                  >
                    <PaletteRow :command="row.command" :active="row.index === activeIndex" />
                  </div>
                </div>
              </template>

              <!-- presentation: a listbox must not hold a non-option child. -->
              <div v-else role="presentation" class="flex flex-col items-center py-12 text-ink-gray-4">
                <component
                  :is="isLoading ? LucideLoaderCircle : query ? LucideSearchX : LucideSearch"
                  class="mb-2.5 size-8 opacity-40"
                  :class="{ 'animate-spin': isLoading }"
                />
                <span class="px-4 text-center text-base">{{ emptyMessage }}</span>
              </div>
            </div>
          </Transition>
        </div>

        <div class="flex items-center gap-4 border-t border-outline-gray-1 px-4 py-2.5 text-xs text-ink-gray-4">
          <!-- A phone has none of these keys, so the hints are desktop-only rather than decoration. -->
          <span class="hidden items-center gap-1.5 sm:flex"><ShortcutKey :keys="['↑', '↓']" />{{ __('Navigate') }}</span>
          <span class="hidden items-center gap-1.5 sm:flex"><ShortcutKey :keys="['↵']" />{{ __('Select') }}</span>
          <span v-if="stepLabel" class="hidden items-center gap-1.5 sm:flex"><ShortcutKey :keys="['⌫']" />{{ __('Back') }}</span>
          <span class="ms-auto flex items-center gap-4">
            <!-- The index caps its own result set, so a plateaued count is a floor: `100+`, never a false exact. -->
            <span v-if="resultCount" class="tabular-nums">{{ resultCount }}</span>
            <span class="hidden items-center gap-1.5 sm:flex"><ShortcutKey :keys="['esc']" />{{ escapeLabel }}</span>
          </span>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup>
import SearchInterpretation from '@/components/SearchInterpretation.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { anyModalOpen, SHORTCUTS } from '@/tatva/shortcuts' // TATVA: ⌘K and the modal-open check from the one shortcuts table
import PaletteRow from '@/tatva/palette/PaletteRow.vue'
import { conditions, countError, matchCount, QUERY_TAG, removeCondition, target } from '@/tatva/palette/queryBuilder' // TATVA: the ⌘K query builder's strip
import ShortcutKey from '@/tatva/palette/ShortcutKey.vue'
import {
  back,
  breadcrumb,
  clearSearch,
  closePalette,
  context,
  depth,
  dismissContext,
  flatItems,
  groups,
  isLoading,
  isOpen,
  levels,
  onQueryChange,
  openPalette,
  query,
  resetPalette,
  run,
  searchResponse,
} from '@/tatva/palette/usePalette'
import { Badge, TextInput } from 'frappe-ui'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'
import LucideChevronRight from '~icons/lucide/chevron-right'
import LucideLoaderCircle from '~icons/lucide/loader-circle'
import LucideSearch from '~icons/lucide/search'
import LucideSearchX from '~icons/lucide/search-x'
import LucideX from '~icons/lucide/x'

// TextInput doesn't expose its native input, so we grab it from the DOM.
const inputWrapperRef = ref(null)
const inputRef = computed(() => inputWrapperRef.value?.querySelector('input') ?? null)
const listRef = ref(null)
const activeIndex = ref(0)
const keyboardNav = ref(false)
let focusBeforeOpen = null
// The row the person chose with the keys or the mouse; null while they only type, so the best match leads.
let picked = null

// Rows paired with their flat index — highlighting compares indexes, not object identity.
const renderGroups = computed(() => {
  let index = 0
  return groups.value.map((group) => ({
    title: group.title,
    items: group.items.map((command) => ({ command, index: index++ })),
  }))
})

const optionId = (index) => `command-palette-option-${index}`
const activeOptionId = computed(() => (flatItems.value.length ? optionId(activeIndex.value) : undefined))

const stepLabel = computed(() => (depth.value ? __(breadcrumb.value.at(-1)) : ''))

// TATVA: inside the query builder at any step; at its own level ⌫ removes a condition before it leaves.
const queryDepth = computed(() => levels.value.findIndex((level) => level.tag === QUERY_TAG) + 1)
const inQuery = computed(() => queryDepth.value > 0)
const countLabel = computed(() => {
  if (countError.value) return countError.value
  if (matchCount.value == null) return __('Counting…')
  return __('{0} {1} match', [matchCount.value, __(matchCount.value === 1 ? target.value.one : target.value.many)])
})

// The server's own reading — too_short / building / ready — so an empty list says WHY.
const emptyMessage = computed(() => {
  if (isLoading.value) return __('Searching…')
  const term = query.value.trim()
  const status = searchResponse.value?.status
  if (term && !depth.value) {
    if (status === 'too_short') return __('Keep typing to search leads')
    if (status === 'building') return __('Search is still being prepared')
    // No answer for a searchable query is a failed or switched-off index, never "no such patient".
    if (term.length >= 2 && status !== 'ready') return __('Search is unavailable')
  }
  if (term) return __('No results for "{0}"', [term])
  if (stepLabel.value) return __('Nothing left in {0}', [stepLabel.value])
  return __('Type to search leads, files and commands')
})

const resultAnnouncement = computed(() => {
  if (isLoading.value) return __('Searching…')
  if (!flatItems.value.length) return emptyMessage.value
  return __('{0} results', [String(flatItems.value.length)])
})

// What the index matched in all, not the five-a-kind preview on screen.
const resultCount = computed(() => {
  const total = depth.value ? 0 : searchResponse.value?.total
  return total ? `${total}${searchResponse.value.total_capped ? '+' : ''} ${__('results')}` : ''
})

// Re-keys only on level/chip changes, never on typing.
const levelKey = computed(() => `${depth.value}:${context.value ? 'c' : ''}`)
// Esc peels one layer at a time, so the label tracks what it will actually do.
const escapeLabel = computed(() => {
  if (query.value) return __('Clear')
  if (stepLabel.value) return __('Back')
  return context.value ? __('Remove context') : __('Close')
})
const placeholder = computed(() => {
  if (inQuery.value && depth.value === queryDepth.value) return __('Pick a field or an action…')
  return stepLabel.value ? __('Search…') : __('Search leads or type a command…')
})

// Bound to the dialog, not the input, so keys still work with focus on the back button. Enter on a button must not double up with its own click.
function onKeydown(event) {
  const onButton = event.target?.closest?.('button')
  if (event.key === 'Enter' && onButton) return
  // Ctrl+N/P are what readline-shaped hands reach for.
  const down = event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n')
  const up = event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p')
  if (down) {
    event.preventDefault()
    setActive(activeIndex.value + 1)
  } else if (up) {
    event.preventDefault()
    setActive(activeIndex.value - 1)
  } else if (event.key === 'Home') {
    event.preventDefault()
    setActive(0)
  } else if (event.key === 'End') {
    event.preventDefault()
    setActive(flatItems.value.length - 1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const command = flatItems.value[activeIndex.value]
    if (command) run(command)
  } else if (event.key === 'ArrowRight' && !(event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) && caretAtEnd()) {
    // → drills in, mirroring ⌫ back — only at the caret's end so editing stays native, and never on a childless row.
    const command = flatItems.value[activeIndex.value]
    if (command?.children) {
      event.preventDefault()
      run(command)
    }
  } else if (event.key === 'Backspace' && !query.value) {
    // One layer per press, outermost last: step, then context.
    if (inQuery.value && depth.value === queryDepth.value && conditions.value.length) {
      event.preventDefault()
      removeCondition(conditions.value.length - 1)
    } else if (depth.value) {
      event.preventDefault()
      back()
    } else if (context.value) {
      event.preventDefault()
      dismissContext()
    }
  }
}

function caretAtEnd() {
  const input = inputRef.value
  return !!input && input.selectionStart === input.selectionEnd && input.selectionEnd === input.value.length
}

function setActive(index) {
  keyboardNav.value = true
  const last = flatItems.value.length - 1
  activeIndex.value = Math.min(Math.max(index, 0), last)
  picked = flatItems.value[activeIndex.value] ?? null
  scrollActiveIntoView()
}

// Arrowing scrolls rows under a still cursor; that hover must not steal the highlight.
function onRowHover(index) {
  if (keyboardNav.value) {
    keyboardNav.value = false
    return
  }
  activeIndex.value = index
  picked = flatItems.value[index] ?? null
}

// Esc peels one layer at a time: the query, then the step, then the context, then close.
function onEscape() {
  if (query.value) onQueryChange('')
  else if (depth.value) back()
  else if (context.value) dismissContext()
  else closePalette()
}

function onOpenChange(open) {
  isOpen.value = open
}

// Only when the close left focus nowhere — a row's own focus move (the assignee picker) must win.
function restoreFocus() {
  const target = focusBeforeOpen
  focusBeforeOpen = null
  if (!target?.isConnected) return
  if (document.activeElement !== document.body) return
  target.focus()
}

function scrollActiveIntoView() {
  nextTick(() => listRef.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }))
}

// Late search results rebuild `groups`: a row the person chose keeps the highlight, or Enter runs whatever landed on top; otherwise the best match leads.
watch(groups, () => {
  const index = picked
    ? flatItems.value.findIndex((command) => command.id === picked.id && command.group === picked.group)
    : -1
  activeIndex.value = Math.max(index, 0)
})

// Typing asks a new question, so a choice made for the old one no longer holds; `sync`, so it is cleared before the rows rebuild.
watch(query, () => (picked = null), { flush: 'sync' })

// Reset on open, not close — resetting on close revived the dismissed chip mid-fade. A close only cancels the armed search.
watch(isOpen, (open) => {
  if (!open) return clearSearch()
  resetPalette()
  focusBeforeOpen = document.activeElement
  activeIndex.value = 0
  picked = null
  nextTick(() => inputRef.value?.focus())
})

// Drilling into a sub-list swaps the whole list out; it opens at the top, and the input is refocused for the next query.
watch(depth, () => {
  picked = null
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = 0
    inputRef.value?.focus()
  })
})

// The GUARD no-ops, not the action, so a swallowed ⌘K never eats the browser's while a Dialog is open; the editor keeps its own ⌘K (insert link).
useKeyboardShortcuts({
  ignoreTyping: false,
  skipWhenDialogOpen: false,
  shortcuts: [
    {
      match: SHORTCUTS.search.match,
      guard: () => isOpen.value || (!anyModalOpen() && !document.activeElement?.closest?.('.ProseMirror')),
      action: () => (isOpen.value ? closePalette() : openPalette()),
    },
  ],
})
</script>

<style scoped>
/* Native inputs fall back to the OS "Field" color (white) unless cleared explicitly. */
:deep(input) {
  background-color: transparent;
}

/* Open carries the scale and lift; close is a plain fade so dismissal feels fast. */
.palette-content[data-state='open'] {
  animation: palette-in 160ms cubic-bezier(0.16, 1, 0.3, 1);
}
.palette-content[data-state='closed'] {
  animation: palette-out 110ms ease-in;
}
.palette-overlay[data-state='open'] {
  animation: fade-in 160ms ease-out;
}
.palette-overlay[data-state='closed'] {
  animation: fade-out 110ms ease-in;
}
@keyframes palette-in {
  from {
    opacity: 0;
    transform: translate(-50%, -6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}
@keyframes palette-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* A thin bar while a drill-down or a search is in flight. */
.palette-progress {
  animation: progress 900ms ease-in-out infinite;
  transform-origin: left;
}
@keyframes progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
    opacity: 0;
  }
}

/* grid-template-rows animates to intrinsic height; max-height guesswork cannot. */
.chip-row {
  grid-template-rows: 1fr;
  transition: grid-template-rows 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.chip-enter-active .chip,
.chip-leave-active .chip {
  transition:
    opacity 140ms ease,
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.chip-enter-from,
.chip-leave-to {
  grid-template-rows: 0fr;
}
.chip-enter-from .chip,
.chip-leave-to .chip {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}

/* Enter-only: a leave fade kept old rows visible while Enter targeted the new level, so a fast double-Enter fired a row the user couldn't see. */
.level-enter-active {
  transition:
    opacity 100ms ease,
    transform 100ms ease;
}
.level-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .palette-content,
  .palette-overlay,
  .palette-progress,
  .chip-row,
  .chip,
  .level-enter-active {
    animation: none !important;
    transition: none !important;
  }
}
</style>
