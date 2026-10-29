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
  // Messages are DATA-ONLY (sender omits the `notification` block to avoid a duplicate
  // auto-displayed banner), so title/body come from payload.data. We render exactly one.
  firebase.messaging().onBackgroundMessage((payload) => {
    const d = payload.data || {}
    // One banner per notice type: a newer one replaces the older and still alerts, so a late wake shows the latest, never a pile.
    self.registration.showNotification(d.title || 'TatvaCare CRM', {
      body: d.body || '',
      data: d,
      tag: d.tag || undefined,
      renotify: !!d.tag,
      icon: '/assets/crm/manifest/manifest-icon-192.maskable.png',
    })
  })
}

// A tap focuses a CRM window already open and routes it there (src/tatva/push.js listens); a new window opens only when none is, or the notice belongs to another app.
const SPA = '/crm'
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.route) || SPA, self.location.origin)
  const inSpa = (path) => path === SPA || path.startsWith(SPA + '/')
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = inSpa(url.pathname) && windows.find((w) => inSpa(new URL(w.url).pathname))
      if (!open) return clients.openWindow(url.href)
      open.postMessage({ type: 'tatva-push-open', path: url.pathname.slice(SPA.length) + url.search + url.hash || '/' })
      return open.focus()
    }),
  )
})
