<template>
  <div class="relative flex h-full w-full justify-center">
    <div
      class="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
      :class="widthClass"
      :style="{ top: top }"
    >
      <Icon :icon="icon" class="size-7.5 shrink-0 text-ink-gray-5" />
      <div class="flex flex-col items-center gap-1">
        <!-- TATVA: text-center on the TITLE too. It only had it on the description, so a title that wrapped
             (which it does at every mobile width) left-aligned its lines inside a centred box and read as
             ragged. Both lines centre now, at every width. -->
        <span class="text-center text-lg font-medium text-ink-gray-8">
          {{ computedTitle }}
        </span>
        <span class="text-center text-p-base text-ink-gray-6">
          {{ computedDescription }}
        </span>
      </div>
    </div>
  </div>
</template>
<script setup>
import Icon from '@/components/Icon.vue'
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  icon: {
    type: [String, Object],
    default: 'file-text',
  },
  top: { type: String, default: '35%' },
  width: { type: String, default: 'md' },
})

const computedTitle = computed(() => {
  return props.title ? props.title : __('No {0} Found', [__(props.name)])
})

const computedDescription = computed(() => {
  return props.description
    ? props.description
    : __(
        'It appears that there are currently no {0} available. You can create more {0} by using the Create button.',
        [__(props.name)],
      )
})

// TATVA: the width was a flat fraction of the container at EVERY breakpoint — the default `w-4/12` is
// ~130px on a 390px phone, so "No Comments Found" folded into a four-line ribbon and the sentence below
// it into a column one or two words wide. Mobile now takes nearly the full width and the desktop
// fractions are unchanged, so this is a phone-only correction.
const widthClass = computed(() => {
  switch (props.width) {
    case 'sm':
      return 'w-10/12 sm:w-2/12'
    case 'lg':
      return 'w-11/12 sm:w-8/12'
    default:
      return 'w-11/12 sm:w-4/12'
  }
})
</script>
