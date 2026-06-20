<!--
  TATVA: TatvaBottomSheet — our mobile/PWA bottom sheet, built in the SAME custom style Near Me already
  established (pages/NearMe.vue's draggable sheet: rounded-t-2xl border-t border-outline-gray-2
  bg-surface-white shadow-2xl, plain CSS + our own slide — NOT a framework Dialog). Difference: Near
  Me's sheet is a persistent draggable layout panel; this is a transient picker — it teleports over the
  app, fades a backdrop, slides up, and closes on backdrop tap / Escape / selection. Tokens only (no
  hex), iOS safe-area aware, caps at 85vh and scrolls its body. Reused by SmartViewSheet.
-->
<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-40 bg-black/40"
        @click="close"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform ease-out duration-250"
      enter-from-class="translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transition-transform ease-in duration-200"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="modelValue"
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-outline-gray-2 bg-surface-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <!-- grab handle (same affordance as the Near Me sheet) -->
        <div class="flex shrink-0 justify-center pt-2.5">
          <div class="h-1 w-9 rounded-full bg-surface-gray-4" />
        </div>
        <div
          v-if="title"
          class="shrink-0 px-4 pb-2 pt-3 text-base font-semibold text-ink-gray-9"
        >
          {{ title }}
        </div>
        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>
