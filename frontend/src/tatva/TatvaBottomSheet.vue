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
      <div v-if="modelValue" class="fixed inset-0 z-40 bg-black/40" @click="onBackdrop" />
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
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl border-t border-outline-gray-2 bg-surface-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
        :style="[sheetStyle, kbStyle]"
        role="dialog"
        aria-modal="true"
        @focusin="onFocusIn"
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
        <!-- TATVA: sticky header. A #header slot (a modal's rich #body-title) wins; else the plain
             `title` prop. Either way it stays pinned above the scroll body — never scrolls with content. -->
        <div v-if="$slots.header" class="shrink-0 px-4 pb-2 pt-1">
          <slot name="header" />
        </div>
        <div
          v-else-if="title"
          class="shrink-0 px-4 pb-2 pt-1 text-base font-semibold text-ink-gray-9"
        >
          {{ title }}
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          <slot />
        </div>
        <!-- TATVA: optional sticky footer (e.g. a modal's #actions). Renders nothing when no footer
             slot is passed, so SmartViewSheet (which passes none) is unchanged. Sits above the
             safe-area inset carried by the sheet container. -->
        <div
          v-if="$slots.footer"
          class="shrink-0 border-t border-outline-gray-1 px-4 pb-2 pt-3"
        >
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useSheetDrag } from '@/composables/useSheetDrag'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  // TATVA: false = snap-only (a drag-down can't dismiss) — for wizards/forms that must not be lost
  // to a stray gesture. Default true keeps the picker behaviour (drag down past the threshold closes).
  dismissible: { type: Boolean, default: true },
  // TATVA: false = a backdrop tap won't close (mirrors Dialog's disableOutsideClickToClose).
  dismissOnBackdrop: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}

function onBackdrop() {
  if (props.dismissOnBackdrop) close()
}

// One behaviour for every bottom sheet: content-sized (max-h-[90dvh]) with translateY drag-to-dismiss.
const { sheetStyle, onDragStart, onDragMove, onDragEnd, lockBody, reset } = useSheetDrag({
  mode: 'fit',
  dismissible: props.dismissible,
  onDismiss: close,
})

function onKey(e) {
  if (e.key === 'Escape') close()
}

// TATVA: soft-keyboard handling. A `fixed bottom-0` sheet sits BEHIND the on-screen keyboard, hiding
// the focused field. The visualViewport API reports the actually-visible area; we lift the sheet by the
// keyboard's height (`bottom`) and cap it to the visible height (`maxHeight`) so the field stays in view.
// Pure progressive enhancement — no visualViewport (desktop) ⇒ inset stays 0 and nothing changes.
const kbInset = ref(0) // px the keyboard overlaps the bottom edge
const visibleH = ref(0) // px of the visual viewport while the keyboard is open

const kbStyle = computed(() =>
  kbInset.value ? { bottom: `${kbInset.value}px`, maxHeight: `${visibleH.value}px` } : {},
)

function onViewport() {
  const vv = window.visualViewport
  if (!vv) return
  kbInset.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
  visibleH.value = Math.round(vv.height)
  if (kbInset.value) {
    const el = document.activeElement
    if (el && typeof el.scrollIntoView === 'function')
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }))
  }
}

function bindViewport(on) {
  const vv = window.visualViewport
  if (!vv) return
  if (on) {
    vv.addEventListener('resize', onViewport)
    vv.addEventListener('scroll', onViewport)
    onViewport()
  } else {
    vv.removeEventListener('resize', onViewport)
    vv.removeEventListener('scroll', onViewport)
    kbInset.value = 0
  }
}

function onFocusIn(e) {
  // already-open keyboard, tapping another field: onViewport won't re-fire, so scroll here too.
  if (kbInset.value && e.target?.scrollIntoView)
    requestAnimationFrame(() => e.target.scrollIntoView({ block: 'center' }))
}

watch(
  () => props.modelValue,
  (open) => {
    lockBody(open) // background stays scroll-locked the whole time the sheet is open
    bindViewport(open)
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
  bindViewport(false)
  lockBody(false)
})
</script>

<style>
/* TATVA: reka-ui teleports popover/menu content (DatePicker calendar, Link/Select combobox, Dropdown)
   to <body> with z-index:auto, so our z-50 sheet covered them — the calendar opened BEHIND the sheet.
   Raise every reka popper above the sheet. Global on purpose: the portaled content is a body sibling
   of the sheet, not a child, so a scoped rule can't reach it. Harmless on desktop (poppers were auto;
   sitting at 60 keeps them above their dialog/sheet, which is what a popover should do). */
[data-reka-popper-content-wrapper] {
  z-index: 60 !important;
}
</style>
