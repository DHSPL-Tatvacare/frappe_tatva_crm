<template>
  <div
    v-if="line"
    class="mt-1 truncate text-xs leading-none"
    :class="line.tone"
    :title="line.hint || line.text"
  >
    {{ line.text }}
  </div>
</template>

<script setup>
// TATVA: the check-in card's third line: the server's reason the pool gives this rep no lead now (lead_flow, the draw's own check), worded here; nothing is decided in the browser (C.26).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { dayjsLocal } from 'frappe-ui'
import { useDocumentVisibility } from '@vueuse/core'
import { useCheckin } from '@/tatva/checkin/useCheckin'

const MINUTE = 60 * 1000
// With no reason, the line counts down only this close to the end of the shift.
const WARN_MS = 15 * MINUTE
// The shift-end check-out is a scheduler cron, which runs up to a minute late; the one re-read waits past that.
const RECHECK_MS = 90 * 1000
// The day name only for another day, so "back 09:00" fits the sidebar.
const at = (iso) => {
  const when = dayjsLocal(iso)
  return when.format(when.isSame(dayjsLocal(), 'day') ? 'HH:mm' : 'ddd HH:mm')
}

// One wording and one tone per server reason; a reason this table does not know shows nothing.
const REASONS = {
  off_shift: {
    tone: 'text-ink-gray-5',
    text: (f) => (f.next_at ? __('Off shift · back {0}', [at(f.next_at)]) : __('Off shift')),
  },
  on_leave: { tone: 'text-ink-gray-5', text: () => __('On leave') },
  not_checked_in: { tone: 'text-ink-gray-5', text: () => __('Not checked in') },
  away: { tone: 'text-ink-gray-5', text: () => __('Away · touch the screen to get leads') },
  disabled: { tone: 'text-ink-gray-5', text: () => __('Not set up for this pool') },
  not_entitled: { tone: 'text-ink-gray-5', text: () => __('Not set up for this pool') },
  paused: { tone: 'text-ink-red-4', text: () => __('Paused by your manager') },
  cap: { tone: 'text-ink-red-4', text: () => __('Shift limit reached') },
  untouched_limit: {
    tone: 'text-ink-red-4',
    text: (f) => __('Paused · {0} untouched', [f.untouched]),
    hint: (f) => __('{0} untouched leads: start or call one to get new leads', [f.untouched]),
  },
}

const { shown, leadFlow, reload } = useCheckin()
const visibility = useDocumentVisibility()
const now = ref(Date.now())
// The countdown applies only while the server says the rep can take leads.
const endsAt = computed(() => {
  const f = leadFlow.value
  return f && !f.reason && f.ends_at ? dayjsLocal(f.ends_at).valueOf() : null
})

// No timer for most of the shift: one timeout to the last 15 minutes, then one a minute, then one re-read after the end; none while hidden.
let timer = null
let asked = null
function schedule() {
  clearTimeout(timer)
  now.value = Date.now()
  const end = endsAt.value
  if (!end || visibility.value !== 'visible') return
  const left = end - now.value
  if (left <= -RECHECK_MS) {
    if (asked !== end) {
      asked = end
      reload()
    }
    return
  }
  const wait =
    left > WARN_MS
      ? left - WARN_MS
      : left > 0
        ? left % MINUTE || MINUTE
        : left + RECHECK_MS
  timer = setTimeout(schedule, wait)
}
watch([endsAt, visibility], schedule, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

const line = computed(() => {
  const f = shown.value ? leadFlow.value : null
  if (!f) return null
  const reason = f.reason && REASONS[f.reason]
  if (reason)
    return { text: reason.text(f), tone: reason.tone, hint: reason.hint?.(f) || '' }
  const left = endsAt.value ? endsAt.value - now.value : 0
  if (left <= 0 || left > WARN_MS) return null
  return {
    text: __('Shift ends in {0} min', [Math.ceil(left / MINUTE)]),
    tone: 'text-ink-amber-3',
    hint: '',
  }
})
</script>
