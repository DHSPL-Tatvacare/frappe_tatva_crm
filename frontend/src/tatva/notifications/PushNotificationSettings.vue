<!-- TATVA: Notifications, screen 2a — push. The browser permission on top, then one row per catalog event.
     A type the operator has not enabled globally is greyed rather than hidden, so the rep knows it exists. -->
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

    <!-- Global: the browser permission, not a stored flag -->
    <div class="flex flex-col">
      <div class="flex items-center px-4 py-2 text-sm text-ink-gray-5">
        {{ __('This device') }}
      </div>
      <div class="mx-4 h-px border-t border-outline-gray-modals" />
      <NotificationToggleRow
        :label="__('Push notifications on this device')"
        :description="
          __(
            'Allow this browser to receive notifications when you are away from the app.',
          )
        "
        :model-value="pushOn"
        @update:model-value="togglePush"
      />
    </div>

    <!-- Per-event opt-ins -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <div class="flex items-center px-4 py-2 text-sm text-ink-gray-5">
        {{ __('Notify me about') }}
      </div>
      <div class="mx-4 h-px border-t border-outline-gray-modals" />

      <div
        v-if="pushPrefs.loading && !pushPrefs.data"
        class="mt-16 flex w-full justify-center"
      >
        <Button :loading="true" variant="ghost" size="2xl" />
      </div>

      <EmptyState
        v-else-if="!rows.length"
        name="Notifications"
        :title="__('Nothing to subscribe to yet')"
        :description="
          __('Your admin has not turned on any notifications for the team.')
        "
        :icon="NotificationsIcon"
        top="20%"
      />

      <ul v-else class="overflow-y-auto px-2">
        <template v-for="(row, i) in rows" :key="row.event_key">
          <NotificationToggleRow
            :label="row.label"
            :description="
              row.available ? row.description : __('Not enabled by your admin')
            "
            :model-value="row.enabled"
            :disabled="!row.available"
            :muted="!row.available"
            @update:model-value="(val) => toggleEvent(row, val)"
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
import { Button, createResource, toast } from 'frappe-ui'
import NotificationsIcon from '@/components/Icons/NotificationsIcon.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'
import { initTatvaPush } from '@/tatva/push'

const updateStep = inject('updateStep')
const pushPrefs = inject('pushPrefs')

const rows = computed(() => pushPrefs.data || [])

const saver = createResource({
  url: 'tatva_connect.notifications.api.save_my_notification_prefs',
})

function toggleEvent(row, val) {
  if (!row.available) return // a greyed type is not the rep's to change; the server refuses it too
  row.enabled = val // optimistic — reverted from the server on error
  saver.submit(
    {
      prefs: rows.value.map((r) => ({
        event_key: r.event_key,
        enabled: r.enabled,
      })),
    },
    {
      onError: () => {
        pushPrefs.reload()
        toast.error(__('Could not save — please try again.'))
      },
    },
  )
}

// The master reflects the live BROWSER permission, not a stored flag. Granting it drives the FCM
// registration prompt; revoking is one-way (only the rep can, in site settings), so we point them there
// rather than fake a state we cannot change.
const pushOn = ref(
  typeof Notification !== 'undefined' && Notification.permission === 'granted',
)

async function togglePush(val) {
  if (val) {
    await initTatvaPush()
    pushOn.value =
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    if (!pushOn.value) {
      toast.error(
        __('Enable notifications for this site in your browser settings.'),
      )
    }
    return
  }
  pushOn.value = false
  toast.info(__('Turn off notifications for this site in your browser settings.'))
}
</script>
