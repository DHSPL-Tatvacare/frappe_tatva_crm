import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { reactive, ref } from 'vue'

// TATVA: Smart Views store — clone of stores/views.js (Pinia setup-store wrapping a frappe-ui
// createResource). Holds (a) the row of tabs from tatva_connect.smartview.api.get_smart_views and
// (b) the per-tab COUNT cache, keyed by view name. Counts are lazy (§6): a tab has no count until
// its list is first loaded; SmartViewList reports each view's `total` here on success, and the
// badge reads it back. No pre-fetch, no batch. Read-only surface.
export const smartViewsStore = defineStore('tatva-smart-views', () => {
  const viewsByName = reactive({})
  // view name -> integer count (the get_data `total`). Absent = "not yet loaded" (no badge).
  const counts = reactive({})
  const loaded = ref(false)

  const views = createResource({
    url: 'tatva_connect.smartview.api.get_smart_views',
    cache: 'tatva-smart-views',
    initialData: [],
    auto: true,
    transform(rows) {
      for (const key of Object.keys(viewsByName)) delete viewsByName[key]
      for (const v of rows || []) {
        viewsByName[v.name] = v
      }
      loaded.value = true
      return rows || []
    },
  })

  function getView(name) {
    return viewsByName[name] || null
  }

  // Lazy count cache (§6). setCount is called by the list on each get_data success, so a re-click
  // that returns a changed `total` updates the badge.
  function getCount(name) {
    return Object.prototype.hasOwnProperty.call(counts, name) ? counts[name] : null
  }
  function setCount(name, total) {
    counts[name] = Number(total) || 0
  }

  async function reload() {
    await views.reload()
  }

  return { views, viewsByName, counts, loaded, getView, getCount, setCount, reload }
})
