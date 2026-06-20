<!--
  TATVA: TatvaBottomSheet — a mobile/PWA bottom sheet. The CRM has no native bottom-sheet primitive,
  so this is the additive one (built on @headlessui/vue Dialog + TransitionChild, the same stack
  MobileSidebar uses — only sliding up from the bottom instead of in from the left). Themed with
  surface/ink tokens only (no hex), respects the iOS safe-area inset, caps at 80vh and scrolls its
  body. Used by SmartViewSheet (the mobile view picker); kept generic so any mobile slide-up can reuse it.
-->
<template>
  <TransitionRoot :show="modelValue" as="template">
    <Dialog as="div" class="relative z-50" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40" />
      </TransitionChild>

      <div class="fixed inset-x-0 bottom-0">
        <TransitionChild
          as="template"
          enter="transform transition ease-out duration-250"
          enter-from="translate-y-full"
          enter-to="translate-y-0"
          leave="transform transition ease-in duration-200"
          leave-from="translate-y-0"
          leave-to="translate-y-full"
        >
          <DialogPanel
            class="flex max-h-[80vh] flex-col rounded-t-2xl bg-surface-modal pb-[env(safe-area-inset-bottom)] shadow-xl"
          >
            <!-- grab handle -->
            <div class="flex shrink-0 justify-center pt-2.5">
              <div class="h-1 w-9 rounded-full bg-surface-gray-4" />
            </div>
            <DialogTitle
              v-if="title"
              class="shrink-0 px-4 pb-2 pt-3 text-base font-semibold text-ink-gray-9"
            >
              {{ title }}
            </DialogTitle>
            <div class="flex-1 overflow-y-auto px-2 pb-2">
              <slot />
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue'

defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

function close() {
  emit('update:modelValue', false)
}
</script>
