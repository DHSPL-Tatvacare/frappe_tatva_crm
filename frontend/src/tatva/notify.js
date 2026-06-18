// TATVA: in-app toast surface for an incoming notification. Today the realtime event only
// silently reloads the bell (Notifications.vue) — there is no toast for a notification that
// arrives while the rep is looking at the app. Socket.IO allows multiple handlers, so we
// attach our OWN here instead of editing Notifications.vue.
//
// tatva_connect/notifications/dispatch.py publishes `tatva_notification` (title/body/route)
// to a PRESENT rep only — so the toast and an OS push never both fire for one event. Native
// frappe-ui toast, design tokens only (no hex), light/dark clean. Click the action -> route.
import { toast } from 'frappe-ui'
import router from '@/router'

const TOAST_EVENT = 'tatva_notification'

let started = false

export function startTatvaNotify(crmSocket) {
  if (started || !crmSocket) return
  started = true

  crmSocket.on(TOAST_EVENT, (payload) => {
    if (!payload) return
    const message = [payload.title, payload.body].filter(Boolean).join(' — ')
    if (!message) return
    toast.create({
      message,
      type: 'info',
      action: payload.route
        ? { label: __('View'), onClick: () => router.push(payload.route) }
        : undefined,
    })
  })
}
