import { call } from 'frappe-ui'
import { ref } from 'vue'

// TATVA: the ONE map display config (tatva_connect.location.api.map_config) — provider per surface,
// zoom, OSM tile URL, the Near Me browser key, the address-search country. Mirrors composables/nearMe.js:
// a module-level ref, resolved ONCE and shared by every map surface.
//
// Before this, the three pages that can open a task (Tasks, Smart Views, the lead's activity list) each
// created their own map_config resource with `auto: true` — the same config fetched three times, eagerly,
// even when no task with a location was ever opened — and two of them re-declared the server's defaults
// inline, so an operator's tile URL was honoured or ignored depending on which page you were on.
//
// The server resolves every default (location/api.map_config). Nothing here re-declares one: a surface
// that needs a map waits for this to land (`v-if="mapConfig"`) rather than drawing a guessed one.
export const mapConfig = ref(null)

let pending = null

// Lazy: the first surface that actually needs a map triggers the single fetch; later ones reuse it.
export function useMapConfig() {
  if (!mapConfig.value && !pending) {
    pending = call('tatva_connect.location.api.map_config')
      .then((r) => {
        mapConfig.value = r || null
      })
      .catch(() => {
        mapConfig.value = null // no config => no map drawn, never a guessed one
      })
      .finally(() => {
        pending = null
      })
  }
  return mapConfig
}
