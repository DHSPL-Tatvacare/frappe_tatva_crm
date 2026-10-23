<!-- TATVA: one channel's screen (Email or Push), opened from Notifications: its switch, this device for push, and the notices it carries. -->
<template>
  <div class="flex h-full flex-col gap-6 p-6 text-ink-gray-8">
    <div class="flex px-2 pt-2">
      <Button
        variant="ghost"
        icon-left="chevron-left"
        :label="master.label"
        size="md"
        class="-ml-4 cursor-pointer !justify-start text-xl font-semibold hover:bg-transparent hover:opacity-70 focus:bg-transparent focus:outline-none focus:ring-0"
        @click="emit('back')"
      />
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <section class="flex flex-col">
        <NotificationToggleRow
          :label="master.label"
          :description="systemOn ? master.description : __('Turn on System notifications to use this')"
          :model-value="master.enabled"
          :disabled="!systemOn"
          :muted="!systemOn"
          @update:model-value="(val) => saveSetting(master, val)"
        />
        <template v-if="channel === 'push' && channelOn">
          <div class="mx-4 h-px border-t border-outline-gray-modals" />
          <NotificationToggleRow
            :label="__('This device')"
            :description="deviceText"
            :model-value="pushDevice.state === 'on'"
            :disabled="['unsupported', 'blocked', 'working'].includes(pushDevice.state)"
            @update:model-value="(val) => (val ? enableThisDevice() : disableThisDevice())"
          />
        </template>
      </section>

      <section class="flex flex-col">
        <div class="px-4 py-2 text-sm text-ink-gray-5">
          {{ channel === 'push' ? __('Push me about') : __('Email me about') }}
        </div>
        <ul class="mx-4 divide-y divide-outline-gray-modals border-t border-outline-gray-modals">
          <li v-for="row in rows" :key="row.type" class="flex items-center gap-3 py-3">
            <div class="flex min-w-0 flex-1 flex-col">
              <div
                class="truncate text-p-base font-medium"
                :class="channelOn && row.available ? 'text-ink-gray-8' : 'text-ink-gray-4'"
              >
                {{ row.label }}
              </div>
              <div
                class="truncate text-p-sm"
                :class="channelOn && row.available ? 'text-ink-gray-5' : 'text-ink-gray-4'"
              >
                {{ row.available ? row.description : __('Not switched on for your team') }}
              </div>
            </div>
            <Checkbox
              class="shrink-0"
              :model-value="row[channel].enabled"
              :disabled="!channelOn || !row.available"
              @update:model-value="(val) => saveSetting(row[channel], val)"
            />
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Button, Checkbox } from 'frappe-ui'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'
import { disableThisDevice, enableThisDevice, pushDevice } from '@/tatva/push'

const props = defineProps({
  channel: { type: String, required: true }, // 'email' | 'push'
  data: { type: Object, required: true },
  saveSetting: { type: Function, required: true },
})
const emit = defineEmits(['back'])

const master = computed(() => props.data[props.channel])
const systemOn = computed(() => !!props.data.master.enabled)
const channelOn = computed(() => systemOn.value && master.value.enabled)
// Push carries only the notices that have a push cell; email also carries its feature-only rows (meeting reminders).
const rows = computed(() => props.data.grid.filter((row) => row[props.channel]))

// This browser's push state, read off the ONE push layer; the screen only words it.
const DEVICE_TEXT = {
  off: __('Tick a notice below to get alerts here.'),
  unsupported: __('This browser cannot show alerts. On iPhone, add the CRM to your Home Screen and open it from there.'),
  ask: __('Turn on, then Allow when your browser asks.'),
  declined: __('Off on this device. Turn on to get alerts here.'),
  blocked: __('Blocked by this browser. Allow notifications for this site in its settings, then reload.'),
  working: __('Setting up alerts on this device…'),
  on: __('Alerts arrive here, even when the app is closed.'),
}
const deviceText = computed(() =>
  pushDevice.state === 'failed'
    ? __('Could not set up alerts: {0}', [pushDevice.error])
    : DEVICE_TEXT[pushDevice.state],
)
</script>
