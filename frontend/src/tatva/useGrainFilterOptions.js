import { computed } from 'vue'
import { createResource } from 'frappe-ui'

// TATVA: the ONE frontend source for grain FILTER values. Wraps
// tatva_connect.lead.filters.grain_filter_options, which returns the distinct grain values on the leads
// the caller can actually see (native get_list => native User Permission).
//
// Why this exists: the lead LIST is scoped, but its value dropdowns were not. They are fed by frappe's
// Link search, which is called with the target doctype and no `reference_doctype`, so our narrow
// CRM-Lead-scoped User Permission never fires and the picker offered the whole master — an Anaya rep
// could read the names of every other business line. Asking the lead table is self-scoping and, unlike a
// permission-based filter, still works for a wildcard entitlement (which holds no programme permission).
//
// WHICH fields are grain axes is decided on the SERVER, off the field meta: a field is a grain axis iff
// it is a Link whose target is a grain master. So this file keeps no list of fieldnames — it asks whether
// the endpoint answered for the field. An earlier build hardcoded three names here and the two history
// Links (custom_previous_program, custom_origin_vertical) leaked the whole programme master because they
// were not on it. One rule, stated once, on the server; a grain Link added later needs no change here.
//
// This is the FILTER side and reads WHAT EXISTS. The create picker is the WRITE side and reads WHAT IS
// ALLOWED (the CRM Grain registry, via my_grain_pick_options) so a programme with no leads yet is still
// creatable. The two are deliberately never merged.
//
// One shared, cache-keyed resource => one fetch for the whole session, no per-filter fan-out.

// Grain filtering is a CRM Lead concern; the endpoint answers for that doctype only.
const GRAIN_DOCTYPE = 'CRM Lead'

let _resource = null
function grainFilterResource() {
  if (!_resource) {
    _resource = createResource({
      url: 'tatva_connect.lead.filters.grain_filter_options',
      cache: 'tatva:grain-filter-options',
      auto: true,
    })
  }
  return _resource
}

// A field is a grain axis iff the server answered for it. No name list on this side.
export function isGrainFilterField(doctype, fieldname) {
  if (doctype !== GRAIN_DOCTYPE || !fieldname) return false
  const data = grainFilterResource().data
  return !!data && Object.prototype.hasOwnProperty.call(data, fieldname)
}

export function useGrainFilterOptions() {
  const resource = grainFilterResource()
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
