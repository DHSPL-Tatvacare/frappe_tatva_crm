<!-- TATVA: Notifications, screen 2a — push. The push master, this device's permission, then one row per notification type; a type not available to the team is greyed rather than hidden. -->
<template>
  <div class="flex h-full flex-col gap-6 p-6 text-ink-gray-8">
    <div class="flex px-2 pt-2">
      <Button
        variant="ghost"
        icon-left="chevron-left"
        :label="__('Push notifications')"
        size="md"
        class="-ml-4 cursor-pointer !justify-start text-xl font-semibold hover:bg-transparent hover:opacity-70 focus:bg-transparent focus:outline-none focus:ring-0"
        @click="updateStep('list')"
      />
    </div>

    <div class="flex flex-col">
      <div class="flex items-center px-4 py-2 text-sm text-ink-gray-5">
        {{ __('Push') }}
      </div>
      <div class="mx-4 h-px border-t border-outline-gray-modals" />
      <NotificationToggleRow
        :label="push.master.label"
        :description="
          masterOn
            ? push.master.description
            : __('Turn on System notifications to use this')
        "
        :model-value="push.master.enabled"
        :disabled="!masterOn"
        :muted="!masterOn"
        @update:model-value="(val) => saveSetting(push.master, val)"
      />
    </div>

    <!-- This device: the browser's own permission, not a stored field -->
    <div class="flex flex-col">
      <div class="flex items-center px-4 py-2 text-sm text-ink-gray-5">
        {{ __('This device') }}
      </div>
      <div class="mx-4 h-px border-t border-outline-gray-modals" />
      <NotificationToggleRow
        :label="__('Allow alerts on this device')"
        :description="
          __('Show alerts in this browser, even when the app is not open.')
        "
        :model-value="pushOn"
        @update:model-value="togglePush"
      />
    </div>

    <div class="flex flex-1 flex-col overflow-hidden">
      <div class="flex items-center px-4 py-2 text-sm text-ink-gray-5">
        {{ __('Notify me') }}
      </div>
      <div class="mx-4 h-px border-t border-outline-gray-modals" />
      <ul class="overflow-y-auto px-2">
        <template v-for="(row, i) in rows" :key="row.fieldname">
          <NotificationToggleRow
            :label="row.label"
            :description="describe(row)"
            :model-value="row.enabled"
            :disabled="!usable(row)"
            :muted="!usable(row)"
            @update:model-value="(val) => saveSetting(row, val)"
          />
          <div
            v-if="i !== rows.length - 1"
            class="mx-2 h-px border-t border-outline-gray-modals"
          />
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { Button, toast } from 'frappe-ui'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'
import { initTatvaPush } from '@/tatva/push'

const updateStep = inject('updateStep')
const settings = inject('settings')
const saveSetting = inject('saveSetting')

const push = computed(() => settings.data.push)
const rows = computed(() => push.value.rows)
const masterOn = computed(() => settings.data.master.enabled)

const usable = (row) =>
  masterOn.value && push.value.master.enabled && row.available
function describe(row) {
  if (!row.available) return __('Not available for your team yet')
  if (!masterOn.value) return __('Turn on System notifications to use this')
  if (!push.value.master.enabled)
    return __('Turn on Push notifications to use this')
  return row.description
}

// The browser permission, not a stored flag. Granting drives the FCM registration prompt; revoking is the browser's alone.
const pushOn = ref(
  typeof Notification !== 'undefined' && Notification.permission === 'granted',
)

async function togglePush(val) {
  if (!val) {
    toast.info(
      __('Turn off notifications for this site in your browser settings.'),
    )
    return
  }
  await initTatvaPush()
  pushOn.value =
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  if (!pushOn.value) {
    toast.error(
      __('Enable notifications for this site in your browser settings.'),
    )
  }
}
</script>
