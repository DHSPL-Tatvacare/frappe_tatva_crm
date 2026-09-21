<!-- TATVA: the whole call UI — confirm, pick the DID the patient sees, place, and follow the call to its end in one toast. -->
<template>
  <Dialog v-model="show" :options="{ title: __('Make a Call?') }">
    <template #body-content>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <div class="text-base text-ink-gray-8">
            {{ __('Dial {0}?', [number]) }}
          </div>
          <div class="text-sm text-ink-gray-5">
            {{ __('Your softphone will ring first.') }}
          </div>
        </div>
        <div v-if="context.error" class="text-sm text-ink-red-4">
          {{ context.error.messages?.[0] || context.error.message }}
        </div>
        <template v-else-if="context.data">
          <div class="flex flex-col gap-1.5">
            <div class="text-xs text-ink-gray-5">
              {{ __('Your extension') }}
            </div>
            <div class="text-base text-ink-gray-8">
              {{ context.data.extension }} · {{ context.data.account }}
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="text-xs text-ink-gray-5">{{ __('Call from') }}</div>
            <Autocomplete
              :options="didOptions"
              :modelValue="callerId"
              variant="subtle"
              :placeholder="__('Account caller ID')"
              @change="picked = $event?.value || null"
            />
          </div>
        </template>
      </div>
    </template>
    <!-- The slot, not the `actions` array: that one renders every button w-full and stacked. -->
    <template #actions="{ close }">
      <div class="flex flex-row-reverse gap-2">
        <Button
          variant="solid"
          :label="__('Call')"
          :loading="placing"
          :disabled="!context.data"
          @click="placeCall"
        />
        <Button variant="subtle" :label="__('Cancel')" @click="close" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { globalStore } from '@/stores/global'
import { formatDuration } from '@/utils'
import {
  Autocomplete,
  Button,
  Dialog,
  call,
  createResource,
  toast,
} from 'frappe-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const { setMakeCall, $socket } = globalStore()

const show = ref(false)
const number = ref('')
const placing = ref(false)
const picked = ref(null)
// Calls this tab placed: the rep's other tabs hear the same status and must not toast a call they never showed.
const placed = new Set()

// One fetch per open: the rep's extension on the lead's account, and the DIDs the lead's grain calls from.
const context = createResource({
  url: 'tatva_connect.telephony.bridge.call_context',
})

const didOptions = computed(() =>
  (context.data?.dids || []).map((d) => ({
    label: d.label ? `${d.did_number} · ${d.label}` : d.did_number,
    value: d.did_number,
  })),
)
const callerId = computed(
  () => picked.value || context.data?.default_did || null,
)

// The number is all the seam hands us; the server resolves the lead, its account and its DIDs from it.
function askToCall(to) {
  number.value = String(to ?? '')
  picked.value = null
  context.reset() // a reopened modal never shows the previous number's extension or DIDs
  context.fetch({ to_number: number.value })
  show.value = true
}

// `placing` drives the Button's own loading prop and guards a double-click; the server refuses one anyway.
async function placeCall() {
  if (placing.value) return
  placing.value = true
  try {
    const { name } = await call('tatva_connect.telephony.bridge.make_a_call', {
      to_number: number.value,
      caller_id: callerId.value,
    })
    show.value = false
    placed.add(name)
    // "ringing", never "connected": their 200 means accepted for processing, not answered.
    toast.create({
      id: toastId(name),
      message: __('Ringing your softphone, then {0}…', [number.value]),
      type: 'info',
      duration: 0,
    })
  } catch (e) {
    // Every failure throws with its own reason — provider message, no route, no extension, or a 429.
    toast.error(
      e?.messages?.[0] || e?.message || __('Could not place the call'),
    )
  } finally {
    placing.value = false
  }
}

// How an outbound call ended, keyed by CRM Call Log status; anything else is not an ending.
const ENDINGS = {
  Completed: {
    type: 'success',
    message: (d) => __('Call ended · {0}', [formatDuration(d.duration)]),
  },
  'No Answer': { type: 'warning', message: () => __('No answer') },
  Busy: { type: 'warning', message: () => __('Line busy') },
  Failed: { type: 'error', message: () => __('Call failed') },
  Canceled: { type: 'warning', message: () => __('Call cancelled') },
}

// The ringing toast is replaced in place by the ending: same id, removed and re-created.
function onStatus(data) {
  const ending = ENDINGS[data?.status]
  if (!ending || !placed.has(data.call_log)) return
  placed.delete(data.call_log)
  toast.remove(toastId(data.call_log))
  toast.create({
    id: toastId(data.call_log),
    message: ending.message(data),
    type: ending.type,
  })
}

function toastId(callLog) {
  return `telephony-call-${callLog}`
}

onMounted(() => {
  setMakeCall(askToCall)
  $socket?.on('telephony_call_status', onStatus)
})
onBeforeUnmount(() => $socket?.off('telephony_call_status', onStatus))
</script>
