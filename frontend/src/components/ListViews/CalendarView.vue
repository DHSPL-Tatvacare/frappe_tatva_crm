<template>
  <!-- The month grid is seven fixed columns and the component ships no responsive mode, so on a phone it
       scrolls sideways inside its own container rather than the page body scrolling (constitution H). -->
  <div class="flex-1 overflow-x-auto px-3 pb-3 sm:px-5">
    <!-- The rep is told when the window holds more than the server will draw. A calendar that quietly
         drops events is worse than one that says it is not showing everything, because it is believed. -->
    <div
      v-if="calendar?.data?.truncated"
      class="mb-2 rounded bg-surface-amber-2 px-3 py-2 text-p-sm text-ink-amber-3"
    >
      {{
        __('Showing {0} of {1} in this range. Narrow the list to see the rest.', [
          calendar.data.row_count,
          calendar.data.total_count,
        ])
      }}
    </div>
    <div class="h-full min-w-[44rem]">
      <Calendar
        :events="events"
        :config="calendarConfig"
        :onClick="openTask"
        :onCellClick="createOnDate"
        @rangeChange="onRangeChange"
      />
    </div>
  </div>
</template>

<script setup>
import {
  calendarWindow,
  sameWindow,
  useCalendarWindow,
} from '@/composables/calendarWindow'
import {
  CALENDAR_DATE_FIELD,
  cellDueDate,
  toCalendarEvents,
} from '@/composables/taskCalendar'
import { isDerived } from '@/tatva/derivedField'
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

// The derived field the payload announced, if any — it carries the colours the events wear.
const derived = computed(() => (calendar.value?.data?.fields || []).find(isDerived))

// The component buckets by date, caps each cell and draws its own "N more" into that day. Not ours.
const events = computed(() =>
  toCalendarEvents(calendar.value?.data?.data, derived.value),
)

const activeWindow = useCalendarWindow()

// Until the page's params are the calendar's, its own first fetch reads this window — reloading here would double it.
const paramsAreCalendar = () =>
  calendar.value?.params?.view?.view_type === 'calendar'

function onRangeChange(range) {
  const next = calendarWindow(CALENDAR_DATE_FIELD, range)
  if (!next || sameWindow(activeWindow.value, next)) return
  activeWindow.value = next
  if (!paramsAreCalendar()) return
  calendar.value.params = { ...calendar.value.params, ...next }
  calendar.value.reload()
}

// The component hands back its own parsed event; `id` is the task name, which is what the page opens on.
function openTask({ calendarEvent }) {
  props.options.onClick?.({ name: calendarEvent.id })
}

function createOnDate(data) {
  props.options.onNewClick?.(cellDueDate(data))
}
</script>
