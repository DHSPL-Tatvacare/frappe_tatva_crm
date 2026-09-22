<!-- TATVA: a call renders through the shared ActivityCard (U9). Recording playback lives in the detail
     modal the card opens — the card stays uniform with Notes/Tasks/Attachments. `showTypeIcon` is passed
     through so the Activity rail reuses this SAME component (and its modal) with the tile off. -->
<template>
  <div>
    <ActivityCard
      v-bind="callCard"
      :show-type-icon="showTypeIcon"
      @open="openCallLog"
      @action="(k) => k === 'delete' && confirmDelete()"
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
import { call, createResource, toast } from 'frappe-ui'
import { createDialog } from '@/utils/dialogs'

const props = defineProps({
  activity: { type: Object, default: () => ({}) },
  showTypeIcon: { type: Boolean, default: true },
  // TATVA: the rail is read-only — it strips the overflow from every card it draws, and this is the one it does not build itself.
  showMenu: { type: Boolean, default: true },
})
const emit = defineEmits(['changed'])

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
  if (!callLog.data && !callLog.loading) callLog.fetch()
  showCallLogDetailModal.value = true
}

// A call → the four-slot card. Flavor is `direction · duration`; the handler is the ACTOR and only the actor — printing it in both put the same name on the card twice.
const callCard = computed(() => {
  const c = props.activity
  const incoming = c.type === 'Incoming'
  const icon =
    c.status === 'No Answer' ? MissedCallIcon : c.status === 'Busy' ? DeclinedCallIcon : incoming ? InboundCallIcon : OutboundCallIcon
  const handler = incoming ? c._receiver?.label : c._caller?.label
  const duration = c.status === 'Completed' ? c._duration : ''
  // TATVA: a call that did not connect says why, in the provider's words; a completed one stays quiet.
  const endReason = c.status === 'Completed' ? '' : c.custom_end_reason
  return {
    tile: { kind: 'icon', icon: markRaw(icon), tint: statusColorMap[c.status] === 'red' ? 'red' : 'blue' },
    title: incoming ? __('Inbound Call') : __('Outbound Call'),
    badge: { label: statusLabelMap[c.status] || c.status, theme: statusColorMap[c.status] || 'gray' },
    flavor: [incoming ? __('Incoming') : __('Outgoing'), duration, endReason].filter(Boolean).join(' · '),
    actor: { label: handler || '', image: (incoming ? c._receiver?.image : c._caller?.image) || '' },
    at: c.creation,
    // TATVA: the same overflow the note, task and attachment cards carry — CRM Call Log grants delete to the same three roles they do.
    menu: props.showMenu ? [{ label: __('Delete'), icon: 'trash-2', key: 'delete' }] : [],
  }
})

// TATVA: deleting is the native confirmation over `frappe.client.delete`, which is where the permission is enforced.
function confirmDelete() {
  const c = props.activity
  createDialog({
    title: __('Delete call'),
    message: __('Delete this call log? This cannot be undone.'),
    variant: 'danger',
    actions: [
      {
        label: __('Delete'),
        variant: 'solid',
        theme: 'red',
        onClick: async (close) => {
          try {
            await call('frappe.client.delete', { doctype: 'CRM Call Log', name: c.name })
            toast.success(__('Call deleted'))
            close()
            emit('changed')
          } catch (e) {
            toast.error(e?.messages?.[0] || e?.message || __('Could not delete the call.'))
          }
        },
      },
    ],
  })
}
</script>
