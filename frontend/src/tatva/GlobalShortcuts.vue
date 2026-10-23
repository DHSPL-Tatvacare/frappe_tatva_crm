<!-- TATVA: the app-wide shortcuts (⌘/ lists them, ⌘, toggles Settings) and the list itself, laid out as Helpdesk's ShortcutsModal; desktop only. -->
<template>
  <Dialog v-model="show" :options="{ title: __('Keyboard Shortcuts'), size: '4xl' }">
    <template #body-content>
      <div class="grid w-full grid-cols-2 gap-10 py-1">
        <div
          v-for="group in groups"
          :key="group.title"
          class="pb-4"
          :class="!group.hideBorder && 'border-b border-outline-gray-2'"
        >
          <h2 class="mb-4 text-base font-semibold text-ink-gray-9">{{ group.title }}</h2>
          <ul class="space-y-2">
            <li v-for="item in group.items" :key="item.label" class="flex items-start justify-between gap-4">
              <div class="flex-1 text-base text-ink-gray-7">{{ __(item.label) }}</div>
              <div class="flex justify-end gap-1">
                <span
                  v-for="key in item.keys"
                  :key="key"
                  class="flex h-5 min-w-5 items-center justify-center rounded-sm border border-outline-gray-2 bg-surface-gray-2 text-xs text-ink-gray-8 shadow-sm"
                  :class="key.length > 1 ? 'px-2' : 'w-5'"
                >
                  {{ key }}
                </span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { showSettings } from '@/composables/settings'
import { anyModalOpen } from '@/utils/dialogs'
import { SHORTCUTS } from '@/tatva/shortcuts'
import { Dialog } from 'frappe-ui'
import { ref } from 'vue'

const show = ref(false)

// Grouped as Helpdesk's ShortcutsModal; every row is an entry of the one table.
const groups = [
  {
    title: __('General'),
    items: [SHORTCUTS.search, SHORTCUTS.settings, SHORTCUTS.shortcuts, SHORTCUTS.help],
  },
  {
    title: __('Lead Management'),
    items: [SHORTCUTS.stage, SHORTCUTS.assign, SHORTCUTS.copyId, SHORTCUTS.copyUrl],
  },
  { title: __('Navigation'), items: [SHORTCUTS.nextLead, SHORTCUTS.previousLead], hideBorder: true },
]

// Each key closes its own surface even while it is the open modal, and never opens over another one.
useKeyboardShortcuts({
  skipWhenDialogOpen: false,
  shortcuts: [
    {
      match: SHORTCUTS.shortcuts.match,
      guard: () => show.value || !anyModalOpen(),
      action: () => (show.value = !show.value),
    },
    {
      match: SHORTCUTS.settings.match,
      guard: () => showSettings.value || !anyModalOpen(),
      action: () => (showSettings.value = !showSettings.value),
    },
  ],
})
</script>
