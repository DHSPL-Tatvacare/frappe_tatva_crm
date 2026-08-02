<!--
  TATVA: ResponsiveDialog — render a modal as the stock frappe-ui Dialog on DESKTOP, or as a mobile
  TatvaBottomSheet when the viewport is mobile (<768px). Dialog-compatible API, so adopting a modal is
  a tag swap (<Dialog> -> <ResponsiveDialog>) with the SAME slots. Desktop is byte-for-byte the stock
  Dialog (all slots + $attrs forwarded); it is NEVER a sheet. A modal can opt out via `:sheet="false"`.

  Sheet-mode slot mapping: #body-title / #body-header -> sheet sticky header · #body-content (and #body)
  -> sheet body · #actions -> sheet sticky footer. `size` is ignored in sheet mode (sheets are
  full-width) but still drives the desktop Dialog. New generic primitive on the native lifecycle
  (UI constitution C.15).
-->
<template>
  <TatvaBottomSheet
    v-if="renderAsSheet"
    :modelValue="modelValue"
    :title="title"
    :dismissOnBackdrop="!disableOutsideClickToClose"
    :mode="mode"
    @update:modelValue="
      (v) => {
        emit('update:modelValue', v)
        if (!v) $attrs.onClose?.()
      }
    "
  >
    <!-- a modal's #body-title / #body-header becomes the sheet's STICKY header (not scroll body). -->
    <template v-if="$slots['body-title'] || $slots['body-header']" #header>
      <slot name="body-title" />
      <slot name="body-header" />
    </template>
    <!-- Stock Dialog renders #body-content INSIDE `px-4 pb-6 pt-5 sm:px-6` (Dialog/Dialog.vue:40), while
         #body replaces that wrapper and carries its own padding. The sheet must honour the SAME contract:
         without this, a #body-content modal sat at the sheet's px-2 (edge to edge) while a #body modal sat
         at px-2 + its own px-4 — the two looked like different products. -->
    <div v-if="$slots['body-content']" class="px-4 pb-6 pt-5 sm:px-6">
      <slot name="body-content" />
    </div>
    <slot name="body" />
    <!-- `#body-main` is the stock Dialog's inner body — the one slot that leaves Dialog's OWN actions
         footer alive (Dialog.vue: `<slot name="body">` WRAPS the actions block, so a #body modal replaces
         it and loses its footer). Sheet mode forwarded #body and #body-content but not this, so such a
         modal rendered an EMPTY sheet on mobile. Purely additive: nothing rendered it here before. -->
    <slot name="body-main" />
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

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // Stock Dialog options ({ title, size, ... }) — passed through untouched on the desktop path.
  options: { type: Object, default: () => ({}) },
  disableOutsideClickToClose: { type: Boolean, default: false },
  // Per-instance opt-out: a modal can force the centered Dialog even on mobile.
  sheet: { type: Boolean, default: true },
  // TATVA: forwarded to TatvaBottomSheet, whose own default this repeats — a sheet whose content ARRIVES
  // is 'snap' (H6), one that wraps a known short list is 'fit'. Ignored on the desktop Dialog branch.
  mode: { type: String, default: 'fit' },
})
const emit = defineEmits(['update:modelValue'])

// Sheet on mobile by default; desktop always gets the centered Dialog. A modal can opt out with sheet=false.
const renderAsSheet = computed(
  () => isMobileView.value && props.sheet !== false,
)
const title = computed(() => props.options?.title || '')
</script>
