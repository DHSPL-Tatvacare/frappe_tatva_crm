import { createResource } from 'frappe-ui'

// TATVA: the ONE source for the user's notification settings — frappe-ui's cache key hands the settings panel and the presence heartbeat the same resource.
export function notificationSettingsResource() {
  return createResource({
    url: 'tatva_connect.notifications.api.get_my_notification_settings',
    cache: ['tatvaNotifications', 'settings'],
    auto: true,
  })
}

// TATVA: the ONE rule for "this rep wants push": push can send, system notifications and push are on, and at least one notice is ticked.
export function wantsPush(data) {
  return (
    !!data?.push.available &&
    data.master.enabled &&
    data.push.enabled &&
    data.grid.some((row) => row.push?.enabled)
  )
}
