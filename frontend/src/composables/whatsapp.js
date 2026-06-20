import { call, createResource } from 'frappe-ui'
import { ref } from 'vue'

export const whatsappEnabled = ref(false)
export const isWhatsappInstalled = ref(false)

// TATVA: lead-aware WhatsApp gate (replaces the retired whatsapp_gate.js DOM hack).
// The WhatsApp tab/buttons are gated by GRAIN ROUTING — a lead with no WATI route never shows the
// tab. Decision comes from the SAME server rules used to send (tatva_connect.whatsapp.routing.
// lead_has_route → resolve_account_for_lead), so it tracks CRM WATI Account Routing automatically.
// Non-lead surfaces (deals) keep native behaviour (routed = true; WhatsApp gated by whatsappEnabled only).
// Fail-closed: a route-check error sets routed=false (no route = hidden), matching the old gate.
export const whatsappRouted = ref(true)

// Memoize the per-lead route decision so a revisit/reload is SYNCHRONOUS. Without this, every load
// blanked whatsappRouted to false → the gated WhatsApp tab vanished then reappeared async → the native
// useActiveTabManager (watch(tabs) → getActiveTab) reset the active tab to the first one, so the
// indicator jumped WhatsApp → first → WhatsApp. We never blank synchronously now: keep the current
// value until the (cached) answer is set.
const _routeCache = new Map() // lead name -> has_route

export function resolveWhatsappRoute(doctype, name) {
  if (doctype !== 'CRM Lead' || !name) {
    whatsappRouted.value = true
    return
  }
  if (_routeCache.has(name)) {
    whatsappRouted.value = _routeCache.get(name) // synchronous on revisit — no flicker, no tab reset
    return
  }
  call('tatva_connect.whatsapp.routing.lead_has_route', {
    reference_doctype: doctype,
    reference_name: name,
  })
    .then((r) => {
      const routed = !!(r && r.has_route)
      _routeCache.set(name, routed)
      whatsappRouted.value = routed
    })
    .catch(() => {
      _routeCache.set(name, false) // fail-closed: no route on error
      whatsappRouted.value = false
    })
}

createResource({
  url: 'crm.api.whatsapp.is_whatsapp_enabled',
  cache: 'Is Whatsapp Enabled',
  auto: true,
  onSuccess: (data) => {
    whatsappEnabled.value = Boolean(data)
  },
})

createResource({
  url: 'crm.api.whatsapp.is_whatsapp_installed',
  cache: 'Is Whatsapp Installed',
  auto: true,
  onSuccess: (data) => {
    isWhatsappInstalled.value = Boolean(data)
  },
})
