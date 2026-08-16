<!-- TATVA: Notifications — a channel list that drills into one channel's switches. Same shape as
     Settings/AssignmentRules: this holds the `step`, provides `updateStep`, and the screens are children.
     Both resources are fetched here once and provided down, so drilling in and back costs no call. -->
<template>
  <PushNotificationSettings v-if="step.screen === 'push'" />
  <EmailNotificationSettings v-else-if="step.screen === 'email'" />
  <NotificationChannelList v-else />
</template>

<script setup>
import { provide, ref } from 'vue'
import { createResource } from 'frappe-ui'
import NotificationChannelList from '@/tatva/notifications/NotificationChannelList.vue'
import PushNotificationSettings from '@/tatva/notifications/PushNotificationSettings.vue'
import EmailNotificationSettings from '@/tatva/notifications/EmailNotificationSettings.vue'

const step = ref({ screen: 'list', data: null })
provide('step', step)
provide('updateStep', updateStep)

function updateStep(newStep, data = null) {
  step.value = { screen: newStep, data }
}

// One row per catalog event. `available` = the operator globally enabled it; `enabled` = the rep's opt-in.
const pushPrefs = createResource({
  url: 'tatva_connect.notifications.api.get_my_notification_prefs',
  cache: ['tatvaNotifications', 'push_prefs'],
  auto: true,
})

// The caller's own frappe `Notification Settings` row: { master: {...}, rows: [...] }.
const emailPrefs = createResource({
  url: 'tatva_connect.notifications.api.get_my_email_prefs',
  cache: ['tatvaNotifications', 'email_prefs'],
  auto: true,
})

provide('pushPrefs', pushPrefs)
provide('emailPrefs', emailPrefs)
</script>
