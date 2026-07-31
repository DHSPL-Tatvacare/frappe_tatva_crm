<template>
  <!-- The month grid is seven fixed columns and the component ships no responsive mode, so on a phone it
       scrolls sideways inside its own container rather than the page body scrolling (constitution H). -->
  <div class="flex-1 overflow-x-auto px-3 pb-3 sm:px-5">
    <div class="h-full min-w-[44rem]">
      <Calendar
        :events="events"
        :config="calendarConfig"
        :onClick="openTask"
        :onCellClick="createOnDate"
      />
    </div>
  </div>
</template>

<script setup>
import { cellDueDate, toCalendarEvents } from '@/composables/taskCalendar'
import { Calendar } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps({
  options: {
    type: Object,
    default: () => ({
      onClick: null,
      onNewClick: null,
    }),
  },
})

// TATVA: the SAME list resource every other view type renders from — a view type does not own a fetch.
const calendar = defineModel({ type: Object })

// Read-only, Phase A/B: `isEditMode` off is the ONE lever that keeps drag-to-reschedule, the inline edit
// modal and delete out — they are write paths and out of scope. 24h is what makes a clicked slot say 'HH:00'.
const calendarConfig = {
  isEditMode: false,
  defaultMode: 'Month',
  timeFormat: '24h',
}

// The component buckets these by date itself, so every task goes in and it draws the ones on screen.
const events = computed(() => toCalendarEvents(calendar.value?.data?.data))

// The component hands back its own parsed event; `id` is the task name, which is what the page opens on.
function openTask({ calendarEvent }) {
  props.options.onClick?.({ name: calendarEvent.id })
}

function createOnDate(data) {
  props.options.onNewClick?.(cellDueDate(data))
}
</script>
