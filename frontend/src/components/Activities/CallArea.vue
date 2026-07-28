<!-- TATVA: a call renders through the shared ActivityCard (U9). Recording playback lives in the detail
     modal the card opens — the card stays uniform with Notes/Tasks/Attachments. `showTypeIcon` is passed
     through so the Activity rail reuses this SAME component (and its modal) with the tile off. -->
<template>
  <div>
    <ActivityCard
      v-bind="callCard"
      :show-type-icon="showTypeIcon"
      @open="openCallLog"
    />
    <CallLogDetailModal
      v-if="showCallLogDetailModal"
      v-model="showCallLogDetailModal"
      v-model:callLog="callLog"
    />
  </div>
</template>
<script setup>
import { computed, markRaw, ref } from 'vue'
import ActivityCard from '@/tatva/ActivityCard.vue'
import InboundCallIcon from '@/components/Icons/InboundCallIcon.vue'
import OutboundCallIcon from '@/components/Icons/OutboundCallIcon.vue'
import MissedCallIcon from '@/components/Icons/MissedCallIcon.vue'
import DeclinedCallIcon from '@/components/Icons/DeclinedCallIcon.vue'
import CallLogDetailModal from '@/components/Modals/CallLogDetailModal.vue'
import { statusLabelMap, statusColorMap } from '@/utils/callLog.js'
import { createResource } from 'frappe-ui'

const props = defineProps({
  activity: { type: Object, default: () => ({}) },
  showTypeIcon: { type: Boolean, default: true },
})

// TATVA: the log is read ONLY by the detail modal, so it is fetched when the card is OPENED, never on
// mount — a lead with 103 calls was firing 103 get_call_log requests to paint 103 cards, none of which
// read one. Cached by call, so reopening the same card is instant.
const callLog = createResource({
  url: 'crm.fcrm.doctype.crm_call_log.crm_call_log.get_call_log',
  params: { name: props.activity.name },
  cache: ['call_log', props.activity.name],
})
const showCallLogDetailModal = ref(false)

function openCallLog() {
  callLog.fetch()
  showCallLogDetailModal.value = true
}

// A call → the four-slot card shape. Tile icon reads direction/outcome; the badge carries the status; the
// flavor line is `direction · duration · {handler}` — handler being the internal/external signal
// `_label_external_agents` already derived (a CRM user name, or "External"). No new field, no extra badge.
const callCard = computed(() => {
  const c = props.activity
  const incoming = c.type === 'Incoming'
  const icon =
    c.status === 'No Answer' ? MissedCallIcon : c.status === 'Busy' ? DeclinedCallIcon : incoming ? InboundCallIcon : OutboundCallIcon
  const handler = incoming ? c._receiver?.label : c._caller?.label
  const duration = c.status === 'Completed' ? c._duration : ''
  return {
    tile: { kind: 'icon', icon: markRaw(icon), tint: statusColorMap[c.status] === 'red' ? 'red' : 'blue' },
    title: incoming ? __('Inbound Call') : __('Outbound Call'),
    badge: { label: statusLabelMap[c.status] || c.status, theme: statusColorMap[c.status] || 'gray' },
    flavor: [incoming ? __('Incoming') : __('Outgoing'), duration, handler].filter(Boolean).join(' · '),
    actor: { label: handler || '', image: (incoming ? c._receiver?.image : c._caller?.image) || '' },
    at: c.creation,
  }
})
</script>
