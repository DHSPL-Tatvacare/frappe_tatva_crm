<!-- TATVA: the lead hover card — fetches through the per-lead memo on open and hands the payload to RecordCard; the server decides the rows. -->
<template>
  <RecordCard
    :loading="pending"
    :message="unavailable"
    :title="card?.title"
    :image="card?.image"
    :rows="card?.rows"
  >
    <template #actions>
      <button
        type="button"
        class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2 hover:text-ink-gray-8"
        :aria-label="__('Copy Lead ID')"
        :title="__('Copy Lead ID')"
        @click="copyToClipboard(name)"
      >
        <FeatherIcon name="copy" class="size-4" />
      </button>
    </template>
  </RecordCard>
</template>

<script setup>
import RecordCard from '@/tatva/RecordCard.vue'
import { ensureLeadPreview, knownLeadPreview } from '@/tatva/leadPreview'
import { copyToClipboard } from '@/utils'
import { FeatherIcon } from 'frappe-ui'
import { computed, onUnmounted, ref } from 'vue'

const props = defineProps({
  name: { type: [String, Number], default: '' },
})

// The memo answers on the first frame for a lead already seen, so a re-hover paints and asks nothing.
const entry = ref(knownLeadPreview(props.name))
const card = computed(() => entry.value?.card || null)
const settled = ref(false)
const pending = computed(() => !entry.value && !settled.value)

const unavailable = computed(() => {
  if (card.value || pending.value) return ''
  if (entry.value?.refusal === 'missing') return __('Lead does not exist')
  if (entry.value?.refusal === 'forbidden') return __('You are not authorised to view this lead')
  return __('No preview available')
})

// A card closed mid-flight takes the late answer as a no-op; the memo still keeps it for the next open.
let open = true
onUnmounted(() => (open = false))

if (!entry.value) {
  ensureLeadPreview(props.name).then((found) => {
    if (!open) return
    entry.value = found
    settled.value = true
  })
}
</script>
