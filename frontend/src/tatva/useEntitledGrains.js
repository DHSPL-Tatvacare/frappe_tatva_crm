import { computed } from 'vue'
import { createResource } from 'frappe-ui'

// TATVA: the ONE frontend source for the acting user's entitled grains. Wraps the backend brain
// (tatva_connect.access.entitlement.my_entitled_grains) so every grain-aware surface — the Smart View
// editor AND the Lead/Deal create modal — reads the SAME entitlement, not a copy. A single entitled
// grain => locked (applied automatically, never asked); a manager with multiple => a picker; a System
// Manager => `all` (no enumerated grains — those surfaces fall back to their own free fields).
// One shared resource (cache-keyed) => one fetch for the whole session, no per-surface fan-out.
const GRAIN_SEP = '::'

export function axesFromKey(key) {
  const [vertical = '', group = '', program = ''] = String(key || '').split(GRAIN_SEP)
  return { vertical, group, program }
}
export function keyFromAxes(g) {
  return [g?.vertical || '', g?.group || '', g?.program || ''].join(GRAIN_SEP)
}

let _resource = null
function grainResource() {
  if (!_resource) {
    _resource = createResource({
      url: 'tatva_connect.access.entitlement.my_entitled_grains',
      cache: 'tatva:entitled-grains',
      auto: true,
    })
  }
  return _resource
}

export function useEntitledGrains() {
  const resource = grainResource()
  const grainAll = computed(() => !!resource.data?.all)
  const grainList = computed(() => resource.data?.grains || [])
  const grainLoading = computed(() => resource.loading)
  const grainOptions = computed(() =>
    grainList.value.map((g) => ({
      label: [g.vertical, g.group, g.program].filter(Boolean).join(' · ') || __('Universal'),
      value: keyFromAxes(g),
    })),
  )
  // Exactly one entitled grain (and not a System Manager) => applied automatically, never asked.
  const grainLocked = computed(() => !grainAll.value && grainOptions.value.length === 1)
  return { resource, grainAll, grainList, grainLoading, grainOptions, grainLocked }
}
