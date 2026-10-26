// TATVA: what a lead page lends the ⌘K palette, shared by Lead.vue and MobileLead.vue; a page passes the actions it has, and a row whose action is absent is not offered.
import { watch } from 'vue'
import { leadHandle, publish } from './published'
import { forgetLeadVisit, recordLeadVisit } from './recentLeads'

export function useLeadPalette(leadId, doc, error, actions) {
  publish(leadHandle, {
    id: leadId,
    title: () => doc.value.lead_name || leadId,
    stage: () => doc.value.custom_substage,
    // A lead that did not load (gone, or out of reach) offers no change, as its error page offers none.
    missing: () => !!error.value,
    ...actions,
  })
  // The palette's Recent rows are the leads this person opened, on either layout.
  watch(() => doc.value.lead_name, (title) => recordLeadVisit(leadId, title), { immediate: true })
  watch(error, (failed) => failed && forgetLeadVisit(leadId), { immediate: true })
}
