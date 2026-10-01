<!-- TATVA: Notifications — a channel list that drills into one channel's switches, over ONE read of the user's own Notification Settings row; every screen saves through `saveSetting` provided here. -->
<template>
  <PushNotificationSettings v-if="step.screen === 'push'" />
  <EmailNotificationSettings v-else-if="step.screen === 'email'" />
  <NotificationChannelList v-else />
</template>

<script setup>
import { provide, ref } from 'vue'
import { createResource, toast } from 'frappe-ui'
import NotificationChannelList from '@/tatva/notifications/NotificationChannelList.vue'
import PushNotificationSettings from '@/tatva/notifications/PushNotificationSettings.vue'
import EmailNotificationSettings from '@/tatva/notifications/EmailNotificationSettings.vue'
import { notificationSettingsResource } from '@/tatva/notifications/notificationSettings'

const step = ref({ screen: 'list', data: null })
provide('step', step)
provide('updateStep', updateStep)

function updateStep(newStep, data = null) {
  step.value = { screen: newStep, data }
}

const settings = notificationSettingsResource()
provide('settings', settings)

const saver = createResource({
  url: 'tatva_connect.notifications.api.save_my_notification_settings',
})

// Every switch on every screen lands here: only the switch toggled goes back, and the row the server stored comes back.
function saveSetting(row, val) {
  const before = row.enabled
  row.enabled = val // optimistic
  saver.submit(
    { values: { [row.fieldname]: val } },
    {
      onSuccess: (stored) => settings.setData(stored),
      onError: () => {
        row.enabled = before
        toast.error(__('Could not save — please try again.'))
      },
    },
  )
}
provide('saveSetting', saveSetting)
</script>
