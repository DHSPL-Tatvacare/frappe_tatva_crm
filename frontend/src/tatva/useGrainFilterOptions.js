import { computed } from 'vue'
import { createResource } from 'frappe-ui'

// TATVA: the grain FILTER values for the DASHBOARD, whose grain controls are not catalog fields and so have
// no field to carry their own scoping. Wraps tatva_connect.lead.filters.grain_filter_options, which returns
// the distinct grain values on the leads the caller can actually see (native get_list => native User
// Permission), keyed by lead fieldname.
//
// Why scoping is needed at all: a value dropdown fed by frappe's Link search is called with the target
// doctype and no `reference_doctype`, so our narrow CRM-Lead-scoped User Permission never fires and the
// picker offers the whole master — measured on a scoped rep, 13 programmes against the 1 they may work in.
// Asking the lead table is self-scoping and, unlike a permission-based filter, still works for a wildcard
// entitlement (which holds no programme permission at all).
//
// EVERY OTHER SURFACE reads `grain_options` off the field instead (see grainField.js): a filter control is
// handed its values by the same catalog answer that declares the field, so the values cannot arrive late,
// fail separately, or miss a surface that names the column something else. This file is deliberately not
// that mechanism and must not grow back into it — it answers for CRM Lead, for one caller.
//
// This is the FILTER side and reads WHAT EXISTS. The create picker is the WRITE side and reads WHAT IS
// ALLOWED (the CRM Grain registry, via my_grain_pick_options) so a programme with no leads yet is still
// creatable. The two are deliberately never merged.

const resource = createResource({
  url: 'tatva_connect.lead.filters.grain_filter_options',
  params: { doctype: 'CRM Lead' },
  cache: ['tatva:grain-filter-options', 'CRM Lead'],
  auto: true,
})

export function useGrainFilterOptions() {
  const valuesFor = (fieldname) => resource.data?.[fieldname] || []
  return {
    resource,
    valuesFor,
    // {label, value} for a frappe-ui select, with a blank first entry so the filter can be cleared.
    optionsFor: (fieldname) => [
      { label: '', value: '' },
      ...valuesFor(fieldname).map((v) => ({ label: v, value: v })),
    ],
    loading: computed(() => resource.loading),
  }
}
