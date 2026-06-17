<!--
  TatvaWhatsAppWindowNotice — native composer replacement for a CLOSED 24-hour WhatsApp window.

  WhatsApp Business rule: free-text (session) messages are allowed only within 24h of the patient's
  last inbound message; outside it, ONLY approved templates send. crm always renders the free-text
  box, so a rep could type a message WATI then rejects. When the window is closed (decided server-side
  by tatva_connect.api.whatsapp.whatsapp_window_state — last inbound IS Meta's definition), WhatsAppBox
  renders THIS card instead of the textarea: the WhatsApp tab icon + the expiry note + ONE Send Template
  button. A new inbound reopens the window (WhatsAppBox re-checks on message reload). Replaces the retired
  whatsapp_window.js DOM hack. Pure presentation — emits 'send-template' for the parent to open the dialog.
-->
<template>
  <div class="mx-3 my-2.5 rounded-lg border border-outline-gray-1 bg-surface-gray-1 p-3 sm:mx-10">
    <div class="flex items-start gap-2.5">
      <WhatsAppIcon class="mt-0.5 h-5 w-5 shrink-0 text-ink-gray-5" />
      <div class="flex-1">
        <div class="text-sm font-semibold text-ink-gray-8">
          {{ __('This chat is resolved and expired') }}
        </div>
        <div class="mt-0.5 text-xs leading-relaxed text-ink-gray-5">
          {{ __('Chats expire 24 hours after the patient\'s last message. WhatsApp allows only template messages to be sent until they reply.') }}
        </div>
        <Button
          class="mt-2.5"
          variant="solid"
          :label="__('Send Template')"
          @click="emit('send-template')"
        >
          <template #prefix>
            <WhatsAppIcon class="h-4 w-4" />
          </template>
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Button } from 'frappe-ui'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'

const emit = defineEmits(['send-template'])
</script>
