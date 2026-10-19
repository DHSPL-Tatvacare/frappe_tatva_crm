// TATVA: browser/PWA push registration for CRM reps.
//
// Flow: fetch the public web config from tatva_connect → ask permission → register
// the Firebase messaging service worker (its own push scope, no clash with the Workbox
// app SW) → mint an FCM token → hand it to tatva_connect. Everything is a no-op until
// an operator fills CRM Push Settings and turns the switch on (get_web_config returns
// enabled=false until then), and until the rep turns push on (startTatvaPush).
//
// All business logic lives in tatva_connect — this is a thin client that only moves the
// token. Requires the `firebase` npm package.
import { watch } from 'vue'
import { call } from 'frappe-ui'
import { initializeApp } from 'firebase/app'
import { getMessaging, getToken } from 'firebase/messaging'
import {
  notificationSettingsResource,
  wantsPush,
} from '@/tatva/notifications/notificationSettings'

// Firebase messaging SW is served alongside the Workbox SW; we register it at Firebase's
// dedicated push scope so the two never compete for the app scope.
const SW_URL = '/assets/crm/frontend/firebase-messaging-sw.js'
const SW_SCOPE = '/assets/crm/frontend/firebase-cloud-messaging-push-scope'

let started = false

// The FCM token doubles as this browser's presence device id; a rep who declines push has no
// token, and presence.js falls back to a stable per-browser id.
let tatvaDeviceId = null
export function getTatvaDeviceId() {
  return tatvaDeviceId
}

export async function initTatvaPush() {
  if (started) return
  started = true

  if (!('serviceWorker' in navigator) || !('Notification' in window)) return

  const cfg = await call(
    'tatva_connect.notifications.api.get_web_config',
  ).catch(() => null)
  if (!cfg || !cfg.enabled) return

  if ((await Notification.requestPermission()) !== 'granted') return

  const swUrl = `${SW_URL}?config=${encodeURIComponent(JSON.stringify(cfg))}`
  const registration = await navigator.serviceWorker.register(swUrl, {
    scope: SW_SCOPE,
  })

  const messaging = getMessaging(initializeApp(cfg))
  const token = await getToken(messaging, {
    vapidKey: cfg.vapidKey,
    serviceWorkerRegistration: registration,
  })
  if (!token) return
  tatvaDeviceId = token

  await call('tatva_connect.notifications.api.register_token', {
    fcm_token: token,
    device_label: navigator.userAgent.slice(0, 60),
  })
}

// Registers only once the rep wants push, so a rep who never turned it on is never asked for permission.
export function startTatvaPush() {
  const settings = notificationSettingsResource()
  watch(
    () => wantsPush(settings.data),
    (wanted) => wanted && initTatvaPush(),
    { immediate: true },
  )
}
