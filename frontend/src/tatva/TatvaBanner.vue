<template>
  <div
    v-if="notice"
    class="flex shrink-0 items-start gap-2 border-b border-outline-red-2 bg-surface-red-1 px-3 py-2 sm:px-4"
  >
    <FeatherIcon
      name="alert-triangle"
      class="mt-0.5 h-4 w-4 shrink-0 text-ink-red-4"
    />
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="min-w-0 flex-1 text-p-sm text-ink-red-4" v-html="notice.html" />
    <button
      class="shrink-0 rounded text-ink-red-4 hover:text-ink-red-3"
      :aria-label="__('Dismiss')"
      @click="dismiss"
    >
      <FeatherIcon name="x" class="h-3.5 w-3.5" />
    </button>
  </div>
</template>

<script setup>
// The operator's platform notice, read off the boot bag `tatva_connect.api.banner` publishes.
import { computed, ref } from 'vue'
import { FeatherIcon } from 'frappe-ui'
import { useStorage } from '@vueuse/core'
import { sanitizeHTML } from '@/utils'

// A notice is a sentence: text, emphasis, a break and a link. The server sanitised it; this is the floor.
const ALLOWED = {
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'br', 'span', 'p', 'div', 'a'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
}

// Read once, at mount: boot is written to `window` before any script runs and never changes after.
const published = ref(window.tatva_banner || null)
// Dismissal is keyed on the notice's id, so an edited notice is a new id and comes back on its own.
const dismissed = useStorage('tatvaBannerDismissed', '')

const notice = computed(() => {
  const { html, id } = published.value || {}
  if (!html || !id || dismissed.value === id) return null
  return { id, html: sanitizeHTML(html, ALLOWED) }
})

function dismiss() {
  dismissed.value = notice.value.id
}
</script>
