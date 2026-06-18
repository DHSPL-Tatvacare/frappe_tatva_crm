<!-- TATVA: native Notifications prefs panel. Rows derive entirely from the server catalog
     (get_my_notification_prefs returns ONLY globally-enabled grains), so a rep never sees a
     dead toggle and the panel grows/shrinks with what the operator turns on. A master "push
     on this device" switch drives initTatvaPush()/permission. Design tokens only, no hex. -->
<template>
  <SettingsLayoutBase
    :title="__('Notifications')"
    :description="
      __('Choose what you get notified about. Delivered in-app while you are here, or pushed to your devices when you are away.')
    "
  >
    <template #content>
      <div class="flex flex-col gap-6">
        <!-- Master: push on THIS device -->
        <div>
          <div class="text-base font-semibold text-ink-gray-9">
            {{ __('This device') }}
          </div>
          <div class="mt-4">
            <Switch
              size="md"
              :label="__('Push notifications on this device')"
              :description="
                __('Allow this browser to receive notifications when you are away from the app.')
              "
              :model-value="pushOn"
              @change="togglePush"
            />
          </div>
        </div>

        <!-- Per-grain opt-ins -->
        <div>
          <div class="text-base font-semibold text-ink-gray-9">
            {{ __('Notify me about') }}
          </div>
          <div v-if="prefs.loading" class="mt-4 text-p-sm text-ink-gray-5">
            {{ __('Loading…') }}
          </div>
          <div
            v-else-if="!rows.length"
            class="mt-4 text-p-sm text-ink-gray-5"
          >
            {{ __('No notifications are enabled for your organisation yet.') }}
          </div>
          <div v-else class="mt-4 flex flex-col gap-1">
            <Switch
              v-for="row in rows"
              :key="row.grain_key"
              size="md"
              :label="row.label"
              :description="row.description"
              :model-value="row.enabled"
              @change="(val) => toggleGrain(row, val)"
            />
          </div>
        </div>
      </div>
    </template>
  </SettingsLayoutBase>
</template>

<script setup>
import SettingsLayoutBase from '@/components/Layouts/SettingsLayoutBase.vue'
import { initTatvaPush } from '@/tatva/push'
import { Switch, createResource, toast } from 'frappe-ui'
import { ref, computed } from 'vue'

// Stored opt-ins, one row per globally-enabled grain.
const prefs = createResource({
  url: 'tatva_connect.notifications.api.get_my_notification_prefs',
  auto: true,
})
const rows = computed(() => prefs.data || [])

const saver = createResource({
  url: 'tatva_connect.notifications.api.save_my_notification_prefs',
})

function persist() {
  saver.submit(
    { prefs: rows.value.map((r) => ({ grain_key: r.grain_key, enabled: r.enabled })) },
    {
      onError: () => {
        prefs.reload()
        toast.error(__('Could not save — please try again.'))
      },
    },
  )
}

function toggleGrain(row, val) {
  row.enabled = val // optimistic; persist() reverts via reload on error
  persist()
}

// Master push toggle: granting drives the FCM registration/permission prompt. Browser
// permission is one-way revocable (the rep clears it in site settings), so the switch
// reflects the live Notification permission, not a stored flag.
const pushOn = ref(
  typeof Notification !== 'undefined' && Notification.permission === 'granted',
)

async function togglePush(val) {
  if (val) {
    await initTatvaPush()
    pushOn.value =
      typeof Notification !== 'undefined' && Notification.permission === 'granted'
    if (!pushOn.value) {
      toast.error(__('Enable notifications for this site in your browser settings.'))
    }
  } else {
    pushOn.value = false
    toast.info(__('Turn off notifications for this site in your browser settings.'))
  }
}
</script>
