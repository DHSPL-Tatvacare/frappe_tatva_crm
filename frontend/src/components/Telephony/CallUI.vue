<!-- TATVA: the whole call UI — confirm, place, toast, forget. A bridge provider gives no live state to show. -->
<template>
  <Dialog v-model="show" :options="{ title: __('Make a Call?') }">
    <template #body-content>
      <div class="flex flex-col gap-1">
        <div class="text-base text-ink-gray-8">
          {{ __('Dial {0}?', [number]) }}
        </div>
        <div class="text-sm text-ink-gray-5">
          {{ __('Your softphone will ring first.') }}
        </div>
      </div>
    </template>
    <!-- The slot, not the `actions` array: that one renders every button w-full and stacked. -->
    <template #actions="{ close }">
      <div class="flex flex-row-reverse gap-2">
        <Button
          variant="solid"
          :label="__('Call')"
          :loading="placing"
          @click="placeCall"
        />
        <Button variant="subtle" :label="__('Cancel')" @click="close" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { globalStore } from '@/stores/global'
import { Button, Dialog, call, toast } from 'frappe-ui'
import { onMounted, ref } from 'vue'

const { setMakeCall } = globalStore()

const show = ref(false)
const number = ref('')
const placing = ref(false)

// The number is all the seam hands us and all the dialog needs; the record is already on screen.
function askToCall(to) {
  number.value = String(to ?? '')
  show.value = true
}

// `placing` drives the Button's own loading prop and guards a double-click; the server refuses one anyway.
async function placeCall() {
  if (placing.value) return
  placing.value = true
  try {
    await call('tatva_connect.telephony.bridge.make_a_call', {
      to_number: number.value,
    })
    show.value = false
    // "initiated", never "connected": their 200 means accepted for processing, not answered.
    toast.success(__('Call initiated — pick up your softphone'))
  } catch (e) {
    // Every failure throws with its own reason — provider message, no route, no agent number, or a 429.
    toast.error(e?.messages?.[0] || e?.message || __('Could not place the call'))
  } finally {
    placing.value = false
  }
}

onMounted(() => setMakeCall(askToCall))
</script>
