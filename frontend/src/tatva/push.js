// TATVA: the ONE push layer for every browser and phone — prompt only from a tap, silent re-register once allowed, every failure shown, off unregisters.
import { reactive, watch } from 'vue'
import { call } from 'frappe-ui'
import { useStorage } from '@vueuse/core'
import { sessionStore } from '@/stores/session'
import { getApps, initializeApp } from 'firebase/app'
import { getMessaging, getToken } from 'firebase/messaging'
import {
  notificationSettingsResource,
  wantsPush,
} from '@/tatva/notifications/notificationSettings'

// Firebase's own push scope, so its worker never competes with the Workbox app worker.
const SW_URL = '/assets/crm/frontend/firebase-messaging-sw.js'
const SW_SCOPE = '/assets/crm/frontend/firebase-cloud-messaging-push-scope'

// This browser's push state: off | unsupported | ask | declined | blocked | working | on | failed, and the error when failed.
export const pushDevice = reactive({ state: 'off', error: '' })

// This browser's FCM token while registered, so turning push off can unregister exactly it.
let tatvaDeviceId = null

let pending = null

// A rep who turns this device off is remembered on this device only, so a reload never re-registers it.
const deviceOff = useStorage('tatva:push-device-off', false)
// Who this browser last registered, with which token and when, so an app open re-registers only when one changed or a day passed.
const registered = useStorage('tatva:push-registered', { user: '', token: '', at: 0 })
// Daily, as Firebase advises keeping tokens fresh server-side; it also restores a row the server dropped.
const REFRESH_MS = 24 * 60 * 60 * 1000
// The longest a logout waits for this browser to be forgotten, so a slow answer never holds it.
const FORGET_MS = 2000

function set(state, error = '') {
  pushDevice.state = state
  pushDevice.error = error
}

function supported() {
  return (
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  )
}

// Where a browser that has not said yes stands: blocked for good, or waiting for a tap.
function waiting() {
  return Notification.permission === 'denied' ? 'blocked' : 'ask'
}

async function register() {
  const cfg = await call('tatva_connect.notifications.api.get_web_config')
  if (!cfg?.enabled) return set('off')
  const registration = await navigator.serviceWorker.register(
    `${SW_URL}?config=${encodeURIComponent(JSON.stringify(cfg))}`,
    { scope: SW_SCOPE },
  )
  const token = await getToken(getMessaging(getApps()[0] || initializeApp(cfg)), {
    vapidKey: cfg.vapidKey,
    serviceWorkerRegistration: registration,
  })
  if (!token) throw new Error(__('Firebase gave this browser no device token.'))
  const user = sessionStore().user
  const known = registered.value
  if (known.user !== user || known.token !== token || Date.now() - known.at > REFRESH_MS) {
    await call('tatva_connect.notifications.api.register_token', {
      fcm_token: token,
      device_label: navigator.userAgent.slice(0, 60),
    })
    registered.value = { user, token, at: Date.now() }
  }
  tatvaDeviceId = token
  set('on')
}

// One registration at a time; a failure is shown, never swallowed.
function registerOnce() {
  if (!pending) {
    set('working')
    pending = register()
      .catch((e) => {
        console.error('[tatva push]', e)
        set('failed', e?.messages?.[0] || e?.message || String(e))
      })
      .finally(() => (pending = null))
  }
  return pending
}

// This browser's token, held now or stored by an earlier load, is dropped here and on the server.
async function unregister() {
  const token = tatvaDeviceId || registered.value.token
  tatvaDeviceId = null
  registered.value = { user: '', token: '', at: 0 }
  if (token) {
    await call('tatva_connect.notifications.api.unregister_token', {
      fcm_token: token,
    }).catch((e) => console.error('[tatva push]', e))
  }
}

// Logout: this browser stops getting the rep's pushes, waiting at most FORGET_MS while the session still stands.
export function forgetThisDevice() {
  return Promise.race([unregister(), new Promise((resolve) => setTimeout(resolve, FORGET_MS))])
}

// The tap: asking first, before any await, keeps the prompt inside the gesture iOS and Firefox require.
export async function enableThisDevice() {
  if (!supported()) return set('unsupported')
  deviceOff.value = false
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return set(waiting())
  return registerOnce()
}

// The switch off: unregister this browser and remember it here.
export async function disableThisDevice() {
  deviceOff.value = true
  set('declined')
  await unregister()
}

// Once per app load: follow whether the rep wants push, with no prompt — a browser that already said yes registers, any other waits for the tap.
export function startTatvaPush() {
  const settings = notificationSettingsResource()
  watch(
    () => wantsPush(settings.data),
    (wanted) => {
      if (!settings.data) return // not loaded yet is not "push off"
      if (!wanted) {
        set('off')
        return unregister()
      }
      if (!supported()) return set('unsupported')
      if (deviceOff.value) return set('declined')
      if (Notification.permission === 'granted') return registerOnce()
      set(waiting())
    },
    { immediate: true },
  )
}
