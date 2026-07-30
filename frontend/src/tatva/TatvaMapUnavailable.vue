<!-- TatvaMapUnavailable — the ONE way this app says "there is no map here"; fills its parent, caller positions it. -->
<template>
  <div
    class="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-gray-2 p-6 text-center"
  >
    <FeatherIcon name="map" class="h-8 w-8 text-ink-gray-4" />
    <div class="text-base text-ink-gray-6">{{ title }}</div>
    <div class="text-sm text-ink-gray-5">{{ detail }}</div>
    <Button v-if="canRetry" :label="__('Retry')" @click="emit('retry')" />
  </div>
</template>

<script setup>
import { Button, FeatherIcon } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps({
  reason: {
    type: String,
    required: true,
    validator: (v) => ['config', 'load', 'unconfigured'].includes(v),
  },
})

const emit = defineEmits(['retry'])

// Retry only where a reader can actually change the outcome; an unset key is terminal until an operator acts.
const canRetry = computed(() => props.reason !== 'unconfigured')

const title = computed(
  () =>
    ({
      config: __('The map settings could not be loaded.'),
      unconfigured: __('The map is not configured.'),
      load: __('The map could not be loaded.'),
    })[props.reason],
)

const detail = computed(
  () =>
    ({
      config: __('Check your connection and try again.'),
      unconfigured: __(
        'Ask an administrator to set the Google Maps browser key in CRM Maps Settings.',
      ),
      load: __(
        'Check that the browser key allows this site (its HTTP referrer restrictions).',
      ),
    })[props.reason],
)
</script>
