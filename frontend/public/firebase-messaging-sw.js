/* TATVA: Firebase Cloud Messaging service worker (browser/PWA push for CRM reps).
 *
 * Additive — does NOT touch the Workbox app service worker (sw.js). It is registered
 * at Firebase's own narrow scope (.../firebase-cloud-messaging-push-scope), so it only
 * receives push events and never competes with Workbox for the app scope.
 *
 * No config is baked in: the page passes the public web config as a ?config= query
 * param when registering (see src/tatva/push.js), so this file is identical across
 * deployments and carries no secrets.
 */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js')

const config = JSON.parse(new URLSearchParams(self.location.search).get('config') || '{}')

if (config.apiKey) {
  firebase.initializeApp(config)
  firebase.messaging().onBackgroundMessage((payload) => {
    const n = payload.notification || {}
    self.registration.showNotification(n.title || 'TatvaCare CRM', {
      body: n.body || '',
      data: payload.data || {},
      icon: '/assets/crm/manifest/manifest-icon-192.maskable.png',
    })
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const route = (event.notification.data && event.notification.data.route) || '/crm'
  event.waitUntil(clients.openWindow(route))
})
