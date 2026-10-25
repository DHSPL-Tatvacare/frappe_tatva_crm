<!-- TATVA: Quiet hours, opened from Notifications: the person's own From, To and days, in their time zone; no push or email inside them, the bell unaffected. -->
<template>
  <SettingsLayoutBase>
    <template #title>
      <Button
        variant="ghost"
        icon-left="chevron-left"
        :label="__('Quiet hours')"
        size="md"
        class="-ml-4 cursor-pointer !justify-start text-xl font-semibold hover:bg-transparent hover:opacity-70 focus:bg-transparent focus:outline-none focus:ring-0"
        @click="emit('back')"
      />
    </template>
    <template #content>
      <div class="flex flex-col gap-6">
        <section class="flex flex-col">
          <NotificationToggleRow
            :label="__('Quiet hours')"
            :description="
              usable
                ? __(
                    'No push or email in these hours. Your bell still shows everything, and email arrives when they end.',
                  )
                : __('Turn on System notifications to use this')
            "
            :model-value="on"
            :disabled="!usable"
            :muted="!usable"
            @update:model-value="toggle"
          />
          <template v-if="on && usable">
            <div class="h-px border-t border-outline-gray-modals" />
            <div class="flex gap-3 py-3">
              <div
                v-for="edge in EDGES"
                :key="edge.field"
                class="flex min-w-0 flex-1 flex-col gap-1.5 text-p-sm text-ink-gray-5"
              >
                {{ edge.label }}
                <!-- The phone's own time wheel in the sheet, where a popover would sit inside a modal (C.13); frappe-ui's list on desktop. -->
                <FormControl
                  v-if="isMobileView"
                  type="time"
                  :model-value="quiet[edge.key]"
                  @update:model-value="
                    (val) =>
                      val &&
                      val !== quiet[edge.key] &&
                      save({ [edge.field]: val })
                  "
                />
                <TimePicker
                  v-else
                  :value="quiet[edge.key]"
                  :interval="30"
                  @change="(val) => val && save({ [edge.field]: val })"
                />
              </div>
            </div>
            <div class="h-px border-t border-outline-gray-modals" />
            <div class="flex flex-col gap-2 py-3">
              <div class="text-p-sm text-ink-gray-5">{{ __('Days') }}</div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="day in WEEK"
                  :key="day.value"
                  type="button"
                  class="size-8 shrink-0 rounded-full text-p-sm font-medium"
                  :class="
                    chosen.has(day.value)
                      ? 'bg-surface-gray-7 text-ink-white'
                      : 'bg-surface-gray-3 text-ink-gray-6 hover:bg-surface-gray-4'
                  "
                  :title="__(day.label)"
                  :aria-pressed="chosen.has(day.value)"
                  @click="toggleDay(day.value)"
                >
                  {{ __(day.short) }}
                </button>
              </div>
            </div>
            <div class="text-p-sm text-ink-gray-5">
              {{ __('Times are in your time zone: {0}.', [quiet.time_zone]) }}
            </div>
          </template>
        </section>
      </div>
    </template>
  </SettingsLayoutBase>
</template>

<script setup>
import { computed } from 'vue'
import { Button, FormControl, TimePicker } from 'frappe-ui'
import { isMobileView } from '@/composables/settings'
import SettingsLayoutBase from '@/components/Layouts/SettingsLayoutBase.vue'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'
import { QUIET_WEEK as WEEK } from '@/tatva/notifications/notificationSettings'

const props = defineProps({
  data: { type: Object, required: true },
  save: { type: Function, required: true },
})
const emit = defineEmits(['back'])

const EDGES = [
  { key: 'from', field: 'quiet_from', label: __('From') },
  { key: 'to', field: 'quiet_to', label: __('To') },
]

const quiet = computed(() => props.data.quiet)
const usable = computed(
  () => !!props.data.master.enabled && quiet.value.available,
)
const on = computed(() => quiet.value.on) // the server's one rule (quiet_hours.is_on)
const chosen = computed(() => new Set(quiet.value.days))

// On starts the common night every day, which the person then edits; off clears the hours.
function toggle(val) {
  props.save(
    val
      ? {
          quiet_from: '21:00',
          quiet_to: '07:00',
          quiet_days: WEEK.map((d) => d.value),
        }
      : { quiet_from: null, quiet_to: null },
  )
}

function toggleDay(day) {
  const picked = WEEK.map((d) => d.value).filter(
    (d) => chosen.value.has(d) !== (d === day),
  )
  if (picked.length) props.save({ quiet_days: picked }) // the last day stays: turning quiet hours off is the switch's job
}
</script>
