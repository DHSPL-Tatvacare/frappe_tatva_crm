import { createResource } from 'frappe-ui'

// TATVA: the ONE source for the user's notification settings — frappe-ui's cache key hands the settings panel and the presence heartbeat the same resource.
export function notificationSettingsResource() {
  return createResource({
    url: 'tatva_connect.notifications.api.get_my_notification_settings',
    cache: ['tatvaNotifications', 'settings'],
    auto: true,
  })
}
