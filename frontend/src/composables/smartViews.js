import { call } from 'frappe-ui'
import { ref } from 'vue'

// TATVA: Smart Views access gate (sidebar visibility). Clone of composables/nearMe.js — a reactive
// ref populated once on app load from the SAME server rule that authorises the page
// (tatva_connect.smartview.api.access). The link only renders when `smartViewsVisible` is true, so
// stock CRM is unaffected when the tatva backend is absent or no views are seeded. Fail-closed: any
// error keeps it false (no link).
export const smartViewsVisible = ref(false)

export function resolveSmartViewsAccess() {
  call('tatva_connect.smartview.api.access')
    .then((r) => {
      smartViewsVisible.value = !!(r && r.visible)
    })
    .catch(() => {
      smartViewsVisible.value = false
    })
}

// Auto-resolve once on load (mirror nearMe.js).
resolveSmartViewsAccess()
