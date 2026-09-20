<template>
  <div>
    <WhatsAppArea
      v-model="resource"
      v-model:reply="reply"
      class="px-3 sm:px-10"
      :messages="thread.messages.value"
      :failedReasons="failedReasons"
    />
    <div v-if="arrived" class="sticky bottom-3 flex justify-center">
      <Button variant="solid" :label="__('New messages')" icon-left="arrow-down" @click="toBottom" />
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { Button, toast } from 'frappe-ui'
import { useScroll } from '@vueuse/core'
import WhatsAppArea from '@/components/Activities/WhatsAppArea.vue'
import { useWhatsappThread } from '@/tatva/whatsappThread.js'

const props = defineProps({
  scroller: { type: Object, default: null },
  params: { type: Object, required: true },
  failedReasons: { type: Object, default: () => ({}) },
})
const resource = defineModel({ type: Object })
const reply = defineModel('reply', { type: Object, default: () => ({}) })

const thread = useWhatsappThread(resource.value, props.params)
const EDGE = 48 // px from an edge that still counts as being at it
const { arrivedState } = useScroll(() => props.scroller, { offset: { top: EDGE, bottom: EDGE } })
const arrived = ref(false)
const placed = ref(false)

function toBottom() {
  const el = props.scroller
  if (el) el.scrollTop = el.scrollHeight
  arrived.value = false
}

// Immediate: the thread mounts with its page already loaded, so the first placement must not wait for a newer message.
watch(
  thread.newest,
  async (newest, previous) => {
    if (!newest) return
    const atBottom = arrivedState.bottom
    await nextTick()
    if (!placed.value || atBottom) {
      toBottom()
      placed.value = true
    } else if (newest !== previous) {
      arrived.value = true
    }
  },
  { immediate: true },
)

watch(
  () => arrivedState.bottom,
  (bottom) => bottom && (arrived.value = false),
)

// Reaching the top pulls older pages one at a time and holds the rep's place; a short thread fills once placed.
let pulling = false
async function pullOlder() {
  const el = props.scroller
  if (pulling || !placed.value || !el) return
  pulling = true
  try {
    while (el.scrollTop <= EDGE && !thread.exhausted.value) {
      const height = el.scrollHeight
      const pending = thread.loadOlder()
      if (!pending) break
      await pending
      await nextTick()
      el.scrollTop += el.scrollHeight - height
    }
  } catch {
    toast.error(__('Could not load older messages'))
  } finally {
    pulling = false
  }
}

watch([() => arrivedState.top, placed], pullOlder)
</script>
