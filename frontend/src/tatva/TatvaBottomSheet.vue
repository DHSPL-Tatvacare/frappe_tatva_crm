<!--
  TATVA: TatvaBottomSheet — the mobile/PWA picker sheet, in the SAME custom style as the Near Me sheet
  and running the SAME drag engine (composables/useSheetDrag). Teleports over the app, fades a backdrop,
  slides up, and is DRAGGABLE by its handle: drag up to expand, drag down past the threshold to dismiss.
  The background is fully scroll-locked while it's open (overscroll-contain on the body + body overflow
  lock in the engine) — the page behind never scrolls. Closes on the header X / backdrop tap / Escape /
  drag-dismiss, and always slides both ways (enter via `appear`, leave via a decoupled `visible` state so a
  v-if parent can't cut it short). Tokens only, iOS safe-area aware. Reused by SmartViewSheet.
-->
<template>
  <Teleport to="body">
    <Transition
      appear
      enter-active-class="transition-opacity ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-x-0 top-0 bottom-0 z-40 bg-black/40"
        :style="overlayStyle"
        @click="onBackdrop"
      />
    </Transition>

    <Transition
      appear
      enter-active-class="transition-transform ease-out duration-300"
      enter-from-class="translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transition-transform ease-in duration-300"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
      @after-leave="onClosed"
    >
      <div
        v-if="visible"
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl border-t border-outline-gray-2 bg-surface-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
        :style="sheetStyle"
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
        <!-- TATVA: sticky header. Left = a #header slot (a modal's rich #body-title) or the plain `title`
             prop; right = the ONE close X, always present (wiki parity) so every sheet dismisses the same
             way. Stays pinned above the scroll body — never scrolls with content. -->
        <div class="flex shrink-0 items-start gap-2 px-4 pb-2 pt-1">
          <div class="min-w-0 flex-1">
            <slot v-if="$slots.header" name="header" />
            <span
              v-else-if="title"
              class="text-base font-semibold text-ink-gray-9"
            >
              {{ title }}
            </span>
          </div>
          <button
            type="button"
            class="-mr-1 -mt-0.5 shrink-0 rounded p-1 text-ink-gray-7 active:bg-surface-gray-3"
            :aria-label="__('Close')"
            @click="close"
          >
            <FeatherIcon name="x" class="h-4 w-4" />
          </button>
        </div>
        <!-- No gutter here: the shell holds none and the content declares its own, exactly as the stock Dialog does — a gutter on both nested the content 8px inside the header and footer, which is what read as a box within a box. -->
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
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
import { ref, watch, onBeforeUnmount } from 'vue'
import { FeatherIcon } from 'frappe-ui'
import { useSheetDrag } from '@/composables/useSheetDrag'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  // TATVA: false = a backdrop tap won't close (mirrors Dialog's disableOutsideClickToClose).
  dismissOnBackdrop: { type: Boolean, default: true },
  // TATVA: which shape this sheet takes, both already implemented by the one drag engine.
  //   'fit'  (default, unchanged for every existing consumer) — wraps its content. Right for a sheet
  //          whose content is a known, short list: no dead space under it.
  //   'snap' — rests at `collapsed` of the viewport and scrolls inside, and the handle drags it up to
  //          `expanded`. Right for a sheet whose content ARRIVES and varies, where 'fit' makes the sheet
  //          jump from a sliver to full height as results land under the reader's thumb.
  mode: { type: String, default: 'fit' },
  collapsed: { type: Number, default: 0.45 },
  expanded: { type: Number, default: 0.85 },
})
const emit = defineEmits(['update:modelValue'])

// TATVA: on-screen state, decoupled from modelValue. Consumers mount us with `v-if` (LeadModal et al), so a naive close would let the parent unmount us before the leave slide ran — it popped out. We drive visibility here, play the leave, and only emit the model update on @after-leave, by which point the slide is done.
const visible = ref(props.modelValue)

function close() {
  visible.value = false // starts the leave slide; onClosed emits the model update once it finishes
}

function onClosed() {
  emit('update:modelValue', false)
}

function onBackdrop() {
  if (props.dismissOnBackdrop) close()
}

// dismissible is hardcoded, not a prop: a phone has no Escape key, so an opt-out plus dismissOnBackdrop=false would leave a sheet with no exit.
// The engine tracks the visual viewport itself and hands back finished geometry — this component measures nothing, so every sheet on it is keyboard-correct without opting in.
const {
  sheetStyle,
  overlayStyle,
  onDragStart,
  onDragMove,
  onDragEnd,
  lockBody,
  reset,
} = useSheetDrag({
  mode: props.mode,
  collapsed: props.collapsed,
  expanded: props.expanded,
  dismissible: true,
  onDismiss: close,
  anchor: 'viewport', // this sheet is `fixed`; NearMe's is `absolute` in its own container and keeps the default
})

function onKey(e) {
  if (e.key === 'Escape') close()
}

// The sheet is anchored to the visual viewport, so a field is only scrolled to when the keyboard genuinely covers it — an unconditional scrollIntoView dragged the content out from under the reader on every focus.
function onFocusIn(e) {
  const el = e.target
  if (!el?.scrollIntoView) return
  const visible = window.visualViewport?.height ?? window.innerHeight
  if (el.getBoundingClientRect().bottom > visible)
    requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }))
}

// The prop opens/closes us: true → show (the enter slide runs, even on a mount-open sheet, via `appear`); false → play the leave slide. A parent that also v-ifs us away can still cut the leave short, but the common backdrop/X/Escape/drag closes go through close() and slide fully.
watch(
  () => props.modelValue,
  (open) => {
    visible.value = open
  },
)

// Lifecycle keys off the on-screen state, not the prop, so the scroll-lock stays bound for the whole slide (including the leave that outlives modelValue).
watch(
  visible,
  (open) => {
    lockBody(open) // background stays scroll-locked the whole time the sheet is on screen
    if (open) {
      reset()
      window.addEventListener('keydown', onKey)
    } else {
      window.removeEventListener('keydown', onKey)
    }
  },
  // immediate: a sheet can MOUNT already-open (v-if modals, or opened in the same tick), so sync scroll-lock/listeners to the mount state, not just to later changes.
  { immediate: true },
)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  lockBody(false)
})
</script>

<style>
/* TATVA: ONE remedy for ONE mechanism — anything reka-ui PORTALS to <body> lands at `z-index: auto` and
   is therefore painted UNDER this z-50 sheet, even though it opened later and is logically on top. The
   portaled node is a body SIBLING of the sheet, so no scoped or descendant rule can reach it; a media
   query bounded to the same narrow viewport where sheets exist (<768px) can. Desktop never matches, so
   centred-Dialog stacking is untouched. `!important` beats reka's inline z-index (which mirrors the
   content's computed value). Pure CSS — no JS, no DOM mutation, no per-caller patching.

   Two portal families, both from the same cause:
     • popover/menu content — DatePicker calendar, Link/Select combobox, Dropdown. The calendar used to
       open behind the sheet.
     • DIALOG overlays (`DialogPortal` -> `.dialog-overlay`, frappe-ui Dialog/Dialog.vue:3-5). frappe-ui
       ships that overlay with NO z-index at all, so every `createDialog` confirmation — including the
       Smart View editor's Delete — opened behind the sheet that raised it. A confirmation the reader
       cannot see is worse than none: the sheet looks frozen and the destructive action is still armed.
   THE LAYER ORDER THIS APP ACTUALLY USES, declared here because until now it was four undeclared magic
   numbers and a stray 1000, and a reader had no way to know what beats what:

     z-1     decoration inside a card      timeline rails, overlapping avatars
     z-10    sticky inside a panel         Resizer, settings/sidebar internals, the NearMe crosshair
     z-20    app chrome                    AppSidebar, MobileAppHeader, Notifications, call UI
     z-40    sheet backdrop                TatvaBottomSheet
     z-50    sheet / spotlight             TatvaBottomSheet, TatvaSpotlight  <- the top of the APP layer
     z-60    portaled popover content      reka DatePicker / Select / Dropdown (raised below)
     z-100   Popover                       components/frappe-ui/Popover.vue
     z-110   dialog overlay                every createDialog / Dialog (raised below)

   A CONFIRMATION OUTRANKS EVERYTHING, which is why the dialog sits above z-100 and not just above the
   sheet: it is a decision the reader must answer before anything else can be true. Anything new belongs
   in a band above, never a bigger number invented at the call site. */
@media (max-width: 767px) {
  [data-reka-popper-content-wrapper] {
    z-index: 60 !important;
  }
  .dialog-overlay {
    z-index: 110 !important;
  }
}
</style>
