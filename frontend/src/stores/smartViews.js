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
      // The name index follows WHATEVER data is current, cached or fresh, so it is rebuilt here.
      for (const key of Object.keys(viewsByName)) delete viewsByName[key]
      for (const v of rows || []) {
        viewsByName[v.name] = v
      }
      return rows || []
    },
    // `loaded` means THE SERVER HAS ANSWERED, and only onSuccess can say that. It used to be set in
    // `transform`, which frappe-ui also runs when it hydrates this resource from its offline cache
    // (`setData` -> `transform`, resources.js:182/199) — so a cached tab row from a previous session
    // reported itself as loaded, and the page fetched a page of rows for a view this person may no
    // longer hold. Same meaning frappe-ui gives its own `fetched`, which it sets only after a real
    // fetch resolves and checks before hydrating from cache.
    onSuccess() {
      loaded.value = true
    },
  })

  function getView(name) {
    return viewsByName[name] || null
  }

  // Lazy count cache (§6). setCount is called by the list on each get_data success, so a re-click
  // that returns a changed `total` updates the badge. getCount reads counts[name] directly so the
  // reactive `get` trap tracks the (possibly absent) key — a later setCount re-triggers consumers.
  function getCount(name) {
    const v = counts[name]
    return v === undefined ? null : v
  }
  function setCount(name, total) {
    counts[name] = Number(total) || 0
  }

  async function reload() {
    await views.reload()
  }

  return { views, viewsByName, counts, loaded, getView, getCount, setCount, reload }
})
