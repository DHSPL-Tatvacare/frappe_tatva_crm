import { createResource } from 'frappe-ui'

// TATVA: the ONE source for the user's notification settings — frappe-ui's cache key hands the settings panel and push.js the same resource.
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

// TATVA: the week the quiet-hours days are chosen from, in the server's own day names (frappe's Assignment Rule Day); words are translated where they are drawn.
export const QUIET_WEEK = [
  { value: 'Monday', short: 'M', label: 'Monday' },
  { value: 'Tuesday', short: 'T', label: 'Tuesday' },
  { value: 'Wednesday', short: 'W', label: 'Wednesday' },
  { value: 'Thursday', short: 'T', label: 'Thursday' },
  { value: 'Friday', short: 'F', label: 'Friday' },
  { value: 'Saturday', short: 'S', label: 'Saturday' },
  { value: 'Sunday', short: 'S', label: 'Sunday' },
]
