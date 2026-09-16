<template>
  <div>
    <div ref="top" />
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
import { useElementVisibility, useScroll } from '@vueuse/core'
import WhatsAppArea from '@/components/Activities/WhatsAppArea.vue'
import { useWhatsappThread } from '@/tatva/whatsappThread.js'

const props = defineProps({
  scroller: { type: Object, default: null },
  failedReasons: { type: Object, default: () => ({}) },
})
const resource = defineModel({ type: Object })
const reply = defineModel('reply', { type: Object, default: () => ({}) })

const thread = useWhatsappThread(resource.value)
const top = ref(null)
const topVisible = useElementVisibility(top, { scrollTarget: () => props.scroller })
const { arrivedState } = useScroll(() => props.scroller, { offset: { bottom: 48 } })
const arrived = ref(false)
let placed = false

function toBottom() {
  const el = props.scroller
  if (el) el.scrollTop = el.scrollHeight
  arrived.value = false
}

// The thread opens at the bottom; a rep already there follows new messages, one scrolled up is told instead of moved.
watch(thread.newest, async (newest, previous) => {
  if (!newest) return
  const atBottom = arrivedState.bottom
  await nextTick()
  if (!placed || atBottom) {
    toBottom()
    placed = true
  } else if (newest !== previous) {
    arrived.value = true
  }
})

watch(
  () => arrivedState.bottom,
  (bottom) => bottom && (arrived.value = false),
)

// Reaching the top pulls the next older page and holds the rep's place while it lands above them.
watch(topVisible, async (visible) => {
  const el = props.scroller
  while (visible && placed && el && !thread.exhausted.value) {
    const height = el.scrollHeight
    const pending = thread.loadOlder()
    if (!pending) return
    try {
      await pending
    } catch {
      toast.error(__('Could not load older messages'))
      return
    }
    await nextTick()
    el.scrollTop += el.scrollHeight - height
    visible = topVisible.value
  }
})
</script>
