// TATVA: what a mounted screen lends the palette, Helpdesk's listViewFilters.ts + modalStates.ts. The palette sits outside every provide chain, so a screen publishes its own handle and clears it on unmount.
import { getCurrentInstance, onBeforeUnmount, shallowRef } from 'vue'

// The list on screen: { doctype, apply(filters), clear() }, or null.
export const listHandle = shallowRef(null)
// The lead on screen: its actions, run through the page's own paths, or null.
export const leadHandle = shallowRef(null)
// The desktop Settings modal's permission-filtered tabs (a computed), or null on a phone.
export const settingsTabs = shallowRef(null)
// A New lead asked for from elsewhere; the Leads page opens its own form and lowers it.
export const newLeadAsked = shallowRef(false)

// Sets the handle for this component's life; a newer screen's handle is never cleared by an older unmount.
export function publish(slot, value) {
  slot.value = value
  if (getCurrentInstance()) onBeforeUnmount(() => slot.value === value && (slot.value = null))
}
