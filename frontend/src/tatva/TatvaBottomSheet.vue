<!--
  TATVA: TatvaBottomSheet — the mobile/PWA picker sheet, in the SAME custom style as the Near Me sheet
  and running the SAME drag engine (composables/useSheetDrag). Teleports over the app, fades a backdrop,
  slides up, and is DRAGGABLE by its handle: drag up to expand, drag down past the threshold to dismiss.
  The background is fully scroll-locked while it's open (overscroll-contain on the body + body overflow
  lock in the engine) — the page behind never scrolls. Closes on backdrop tap / Escape / drag-dismiss.
  Tokens only, iOS safe-area aware. Reused by SmartViewSheet.
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
      <div v-if="modelValue" class="fixed inset-0 z-40 bg-black/40" @click="close" />
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
        class="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-outline-gray-2 bg-surface-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
        :style="sheetStyle"
        role="dialog"
        aria-modal="true"
      >
        <!-- grab handle (drives the drag engine) -->
        <div
          class="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5"
          @pointerdown="onDragStart"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        >
          <div class="h-1.5 w-10 rounded-full bg-surface-gray-4" />
        </div>
        <div
          v-if="title"
          class="shrink-0 px-4 pb-2 pt-1 text-base font-semibold text-ink-gray-9"
        >
          {{ title }}
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { useSheetDrag } from '@/composables/useSheetDrag'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}

const { sheetStyle, onDragStart, onDragMove, onDragEnd, lockBody, reset } = useSheetDrag({
  collapsed: 0.55,
  expanded: 0.9,
  min: 0.28,
  dismissible: true,
  onDismiss: close,
})

function onKey(e) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.modelValue,
  (open) => {
    lockBody(open) // background stays scroll-locked the whole time the sheet is open
    if (open) {
      reset()
      window.addEventListener('keydown', onKey)
    } else {
      window.removeEventListener('keydown', onKey)
    }
  },
)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  lockBody(false)
})
</script>
