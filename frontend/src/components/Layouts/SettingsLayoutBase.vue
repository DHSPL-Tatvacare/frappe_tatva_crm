<template>
  <!-- TATVA: inside the mobile Settings sheet, whose one header names the screen and whose body scrolls (tatva/settingsSheet.js), the frame draws only the content; the Settings modal is unchanged. -->
  <div v-if="inSheet" class="flex w-full flex-col gap-4 px-4 pb-2 text-ink-gray-8">
    <slot v-if="Boolean($slots['header-actions'])" name="header-actions" />
    <slot v-if="Boolean($slots['header-bottom'])" name="header-bottom" />
    <slot name="content" />
  </div>
  <div v-else class="flex flex-col h-full w-full text-ink-gray-8">
    <!-- Header -->
    <div class="flex justify-between items-start p-4 text-ink-gray-8 sm:p-8">
      <div class="flex flex-col gap-1">
        <slot name="title">
          <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
            {{ title }}
          </h2>
        </slot>
        <slot
          v-if="Boolean($slots['description']) || Boolean(description)"
          name="description"
        >
          <p class="text-p-base text-ink-gray-6">
            {{ description }}
          </p>
        </slot>
      </div>
      <slot v-if="Boolean($slots['header-actions'])" name="header-actions" />
    </div>
    <div v-if="Boolean($slots['header-bottom'])" class="p-4 pt-0 sm:p-8 sm:pt-0">
      <slot name="header-bottom" />
    </div>
    <div class="h-full overflow-y-auto p-4 pt-0 sm:p-8 sm:pt-0">
      <slot name="content" />
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { SETTINGS_SHEET } from '@/tatva/settingsSheet'

const inSheet = inject(SETTINGS_SHEET, null) // TATVA: null in the desktop Settings modal
defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
})
</script>
