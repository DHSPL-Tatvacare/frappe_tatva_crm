// TATVA: the leads this person opened, Helpdesk's `recentTickets.ts`. Per user: a shared browser must not hand one rep's patients to the next login.
import { useStorage } from '@vueuse/core'
import { sessionStore } from '@/stores/session'

const MAX_RECENTS = 5

// Drop the retired spotlight's unscoped key, which held one browser's mixed history.
localStorage.removeItem('spotlightRecents')

const stores = {}
export function recentLeads() {
  const key = `tatva_recent_leads:${sessionStore().user || ''}`
  return (stores[key] ??= useStorage(key, []))
}

// Called by the lead page once its document has a name to show.
export function recordLeadVisit(name, title) {
  if (!name || !title) return
  const recents = recentLeads()
  const others = recents.value.filter((lead) => lead.name !== name)
  recents.value = [{ name, title }, ...others].slice(0, MAX_RECENTS)
}

// A lead that no longer opens (deleted, or out of this person's reach) leaves Recent rather than lead nowhere.
export function forgetLeadVisit(name) {
  const recents = recentLeads()
  recents.value = recents.value.filter((lead) => lead.name !== name)
}
