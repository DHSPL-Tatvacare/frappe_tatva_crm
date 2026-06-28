<!--
  TATVA: ResponsiveDialog — render a modal as the stock frappe-ui Dialog on desktop (and whenever the
  bottom-sheet switch is OFF), or as a mobile TatvaBottomSheet when the switch is ON *and* the viewport
  is mobile. Dialog-compatible API, so adopting a modal is a tag swap (<Dialog> -> <ResponsiveDialog>)
  with the SAME slots. Ships DORMANT: bottomSheetEnabled defaults OFF (invariant 6), so this is
  byte-for-byte the stock Dialog until an operator flips the switch. Desktop is never a sheet.

  Sheet-mode slot mapping: #body-title -> sheet header line · #body-content (and #body) -> sheet body ·
  #actions -> sheet sticky #footer. `size` is ignored in sheet mode (sheets are full-width) but still
  drives the desktop Dialog. New generic primitive on the native lifecycle (UI constitution C.15).
-->
<template>
  <TatvaBottomSheet
    v-if="renderAsSheet"
    :modelValue="modelValue"
    :title="title"
    :dismissible="dismissible"
    :dismissOnBackdrop="!disableOutsideClickToClose"
    @update:modelValue="(v) => { emit('update:modelValue', v); if (!v) $attrs.onClose?.() }"
  >
    <!-- a modal's #body-title / #body-header becomes the sheet's STICKY header (not scroll body). -->
    <template v-if="$slots['body-title'] || $slots['body-header']" #header>
      <slot name="body-title" />
      <slot name="body-header" />
    </template>
    <slot name="body-content" />
    <slot name="body" />
    <template v-if="$slots.actions" #footer>
      <slot name="actions" />
    </template>
  </TatvaBottomSheet>

  <Dialog
    v-else
    v-bind="$attrs"
    :modelValue="modelValue"
    :options="options"
    :disableOutsideClickToClose="disableOutsideClickToClose"
    @update:modelValue="(v) => emit('update:modelValue', v)"
  >
    <!-- Forward EVERY slot verbatim so the off/desktop path is identical to using <Dialog> directly. -->
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </Dialog>
</template>

<script setup>
import { computed } from 'vue'
import { Dialog } from 'frappe-ui'

// Forward arbitrary attrs/listeners (e.g. a modal's @close) to the Dialog ourselves — with two root
// branches Vue can't auto-inherit them. On the sheet branch we fire `onClose` on close (below).
defineOptions({ inheritAttrs: false })
import TatvaBottomSheet from '@/tatva/TatvaBottomSheet.vue'
import { isMobileView } from '@/composables/settings'
import { bottomSheetEnabled } from '@/composables/responsiveDialogs'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // Stock Dialog options ({ title, size, ... }) — passed through untouched on the desktop path.
  options: { type: Object, default: () => ({}) },
  disableOutsideClickToClose: { type: Boolean, default: false },
  // Per-instance opt-out: a modal can force the centered Dialog even on mobile.
  sheet: { type: Boolean, default: true },
  // false = snap-only sheet (wizards/forms that must survive a stray drag-down).
  dismissible: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])

const renderAsSheet = computed(
  () => bottomSheetEnabled.value && isMobileView.value && props.sheet !== false,
)
const title = computed(() => props.options?.title || '')
</script>
