<!--
  TATVA: TatvaSpotlight — the desktop command-palette shell, peer of TatvaBottomSheet (mobile). Teleports
  over the app, fades a blurred backdrop, and drops a top-anchored (pt-[20vh]) rounded panel in the Wiki
  spotlight style. Closes on backdrop tap / Escape. Slots: #header (sticky), default (scrolling body via
  FadedScrollableDiv), #footer (sticky). v-model drives visibility. Tokens only, light/dark aware.
-->
<template>
  <Teleport to="body">
    <Transition name="ts">
      <div v-if="modelValue" class="relative z-50">
        <div
          class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          @click="close"
        />
        <div
          class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[20vh]"
          @click.self="close"
        >
          <div
            class="ts-panel flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-outline-gray-1 bg-surface-white shadow-2xl"
            @keydown.esc.prevent="close"
          >
            <div
              v-if="$slots.header"
              class="shrink-0 border-b border-outline-gray-1"
            >
              <slot name="header" />
            </div>
            <FadedScrollableDiv class="min-h-0 flex-1 overflow-y-auto py-1.5">
              <slot />
            </FadedScrollableDiv>
            <div
              v-if="$slots.footer"
              class="shrink-0 border-t border-outline-gray-1 bg-surface-gray-1"
            >
              <slot name="footer" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup>
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'

defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}
</script>
<style scoped>
/* Fade the backdrop, lift the panel slightly (Wiki's feel). */
.ts-enter-active,
.ts-leave-active {
  transition: opacity 0.2s ease;
}
.ts-enter-from,
.ts-leave-to {
  opacity: 0;
}
.ts-enter-active .ts-panel,
.ts-leave-active .ts-panel {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.ts-enter-from .ts-panel,
.ts-leave-to .ts-panel {
  transform: scale(0.97) translateY(-16px);
  opacity: 0;
}
</style>
