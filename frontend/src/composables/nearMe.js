import { call } from 'frappe-ui'
import { ref } from 'vue'

// TATVA: Near Me access gate (sidebar visibility AND the route guard). Mirrors composables/whatsapp.js —
// a reactive ref populated once on app load from the SAME server rule that authorises the page
// (tatva_connect.near_me.api.near_me_access). The link only renders when `nearMeVisible` is true,
// so stock CRM is unaffected when access is denied. Fail-closed: any error keeps it false (no link).
// (Whether desktop calls route through telephony is the CRM's own `callEnabled`, not duplicated here.)
export const nearMeVisible = ref(false)

// The boot resolution as an awaitable — the router's NearMe guard waits on this (the users.promise
// shape router.beforeEach already uses), so a direct URL is judged by the settled answer, never by
// the ref's not-yet-resolved default (NM-02).
export let nearMeReady = Promise.resolve(false)

export function resolveNearMeAccess() {
  nearMeReady = call('tatva_connect.near_me.api.near_me_access')
    .then((r) => {
      nearMeVisible.value = !!(r && r.visible)
      return nearMeVisible.value
    })
    .catch(() => {
      nearMeVisible.value = false
      return false
    })
  return nearMeReady
}

// Auto-resolve once on load (mirror whatsapp.js).
resolveNearMeAccess()
