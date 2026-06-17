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

export function resolveWhatsappRoute(doctype, name) {
  if (doctype !== 'CRM Lead' || !name) {
    whatsappRouted.value = true
    return
  }
  whatsappRouted.value = false // assume hidden until the route is confirmed (no flicker of a dead tab)
  call('tatva_connect.whatsapp.routing.lead_has_route', {
    reference_doctype: doctype,
    reference_name: name,
  })
    .then((r) => {
      whatsappRouted.value = !!(r && r.has_route)
    })
    .catch(() => {
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
