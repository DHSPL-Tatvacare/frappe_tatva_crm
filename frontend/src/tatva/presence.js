// TATVA: client presence heartbeat — the CRM's own Socket.IO connection IS the presence
// signal, mirrored into Redis by tatva_connect so the server routes a notification to where
// the rep actually is (in-app toast when present, OS push when away).
//
// Heartbeat mark_present every ~30s, but ONLY while the socket is connected AND the tab is
// visible. A sendBeacon mark_away fires on pagehide / tab-hidden so we leave promptly; the
// server-side TTL is the real backstop for the disconnect we never hear (sleep/crash/drop).
//
// device_id = the FCM token when push is registered (so presence subtracts cleanly from the
// FCM subscription set server-side); otherwise a stable per-browser id, so a rep who declined
// push still gets in-app toasts while present. No business logic here — it only moves a beat.
import { call } from 'frappe-ui'
import { getTatvaDeviceId } from '@/tatva/push'

const HEARTBEAT_MS = 30000 // structural: ~3 beats inside the server's 90s presence TTL
const MARK_PRESENT = 'tatva_connect.notifications.presence.mark_present'
const MARK_AWAY = 'tatva_connect.notifications.presence.mark_away'
const DEVICE_KEY = 'tatva_presence_device_id'

let started = false
let socket = null
let timer = null

function deviceId() {
  const token = getTatvaDeviceId()
  if (token) return token
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `web-${crypto.randomUUID()}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function active() {
  return socket?.connected && document.visibilityState === 'visible'
}

function beat() {
  if (active()) call(MARK_PRESENT, { device_id: deviceId() }).catch(() => {})
}

function away() {
  // sendBeacon survives an unloading page where a fetch would be cancelled.
  const id = deviceId()
  const url = `/api/method/${MARK_AWAY}`
  const body = new Blob([JSON.stringify({ device_id: id })], { type: 'application/json' })
  if (navigator.sendBeacon) navigator.sendBeacon(url, body)
  else call(MARK_AWAY, { device_id: id }).catch(() => {})
}

function onVisibility() {
  if (document.visibilityState === 'hidden') away()
  else beat()
}

export function startTatvaPresence(crmSocket) {
  if (started) return
  started = true
  socket = crmSocket

  beat()
  timer = setInterval(beat, HEARTBEAT_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', away)
  socket?.on?.('connect', beat)
}
