import { call } from 'frappe-ui'
import { ref } from 'vue'

// TATVA: Near Me access gate (sidebar visibility). Mirrors composables/whatsapp.js — a reactive
// ref populated once on app load from the SAME server rule that authorises the page
// (tatva_connect.near_me.api.near_me_access). The link only renders when `nearMeVisible` is true,
// so stock CRM is unaffected when access is denied. Fail-closed: any error keeps it false (no link).
// (Whether desktop calls route through telephony is the CRM's own `callEnabled`, not duplicated here.)
export const nearMeVisible = ref(false)

export function resolveNearMeAccess() {
  call('tatva_connect.near_me.api.near_me_access')
    .then((r) => {
      nearMeVisible.value = !!(r && r.visible)
    })
    .catch(() => {
      nearMeVisible.value = false
    })
}

// Auto-resolve once on load (mirror whatsapp.js).
resolveNearMeAccess()
