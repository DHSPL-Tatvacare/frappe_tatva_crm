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
const _routeCache = new Map() // lead name -> has_route (SUCCESSFUL answers only)

// The record whose answer we are currently waiting for. `whatsappRouted` is one ref describing
// "the record on screen", so an answer for any OTHER record must be discarded: navigating A -> B fast
// let A's late promise overwrite B's, and the tab appeared or vanished according to the wrong lead.
let _resolvingFor = ''

export function resolveWhatsappRoute(doctype, name) {
  // Non-lead surfaces (deals) keep native behaviour. Called explicitly rather than left to whatever
  // the previous lead set — a stale `false` from lead A was hiding the quick action on every deal.
  if (doctype !== 'CRM Lead' || !name) {
    _resolvingFor = ''
    whatsappRouted.value = true
    return
  }
  if (_routeCache.has(name)) {
    _resolvingFor = ''
    whatsappRouted.value = _routeCache.get(name) // synchronous on revisit — no flicker, no tab reset
    return
  }
  _resolvingFor = name
  call('tatva_connect.whatsapp.routing.lead_has_route', {
    reference_doctype: doctype,
    reference_name: name,
  })
    .then((r) => {
      const routed = !!(r && r.has_route)
      _routeCache.set(name, routed)
      if (_resolvingFor === name) whatsappRouted.value = routed
    })
    .catch(() => {
      // Fail closed for THIS view, but do NOT cache it. A dropped request is transient; caching it
      // hid the tab for that lead for the rest of the session, and adding the routing row afterwards
      // changed nothing because the memo had no way to be invalidated.
      if (_resolvingFor === name) whatsappRouted.value = false
    })
}

// Routing config changed under us (an operator added a route) — drop the memo so the next visit asks.
export function clearWhatsappRouteCache() {
  _routeCache.clear()
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

// TATVA: per-USER WhatsApp capability gate (mirrors whatsappEnabled above). WhatsApp is a capability
// decoupled from Sales — a user without a WhatsApp role never sees the tab, even on a routed lead.
// Resolved once on load from tatva_connect.api.whatsapp.whatsapp_access (the SAME allow-list the
// server enforces on send). Fail-closed: stays false until/unless the server says has_role.
export const whatsappHasRole = ref(false)

createResource({
  url: 'tatva_connect.api.whatsapp.whatsapp_access',
  cache: 'Tatva Whatsapp Access',
  auto: true,
  onSuccess: (data) => {
    whatsappHasRole.value = !!(data && data.has_role)
  },
})
