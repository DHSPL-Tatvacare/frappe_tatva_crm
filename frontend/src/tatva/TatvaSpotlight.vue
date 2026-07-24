<!--
  TATVA: TatvaSpotlight — the desktop command-palette shell, peer of TatvaBottomSheet (mobile). Teleports
  over the app, fades a blurred backdrop, and drops a top-anchored (pt-[20vh]) rounded panel in the Wiki
  spotlight style. Closes on backdrop tap / Escape. Slots: #header (sticky), default (scrolling body via
  FadedScrollableDiv), #footer (sticky). v-model drives visibility. Tokens only, light/dark aware.
-->
<template>
  <Teleport to="body">
    <!-- The backdrop owns its transition: animating opacity on an ANCESTOR of backdrop-filter makes the blur paint late. -->
    <Transition name="ts-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        @click="close"
      />
    </Transition>
    <Transition name="ts-pop">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[20vh]"
        @click.self="close"
      >
          <div
            class="ts-panel w-full max-w-2xl overflow-hidden rounded-xl border border-outline-gray-1 bg-surface-white shadow-2xl"
            @keydown.esc.prevent="close"
          >
            <div v-if="$slots.header" class="border-b border-outline-gray-1">
              <slot name="header" />
            </div>
            <FadedScrollableDiv class="max-h-[60vh] overflow-y-auto py-1.5">
              <slot />
            </FadedScrollableDiv>
            <div
              v-if="$slots.footer"
              class="border-t border-outline-gray-1 bg-surface-gray-1"
            >
              <slot name="footer" />
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
/* Backdrop fades on its own element, so the blur paints with it instead of after an ancestor's animation. */
.ts-fade-enter-active,
.ts-fade-leave-active {
  transition: opacity 0.2s ease;
}
.ts-fade-enter-from,
.ts-fade-leave-to {
  opacity: 0;
}
/* The panel lifts + fades independently; its container never animates opacity. */
.ts-pop-enter-active .ts-panel,
.ts-pop-leave-active .ts-panel {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.ts-pop-enter-from .ts-panel,
.ts-pop-leave-to .ts-panel {
  transform: scale(0.97) translateY(-16px);
  opacity: 0;
}
</style>
