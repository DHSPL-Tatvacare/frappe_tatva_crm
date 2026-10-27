import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'

// TATVA: Shortcuts store, twin of stores/smartViews.js — saved views, workflows, workspaces and dashboards a person may open, fetched once per session.
export const shortcutsStore = defineStore('tatva-shortcuts', () => {
  const shortcuts = createResource({
    url: 'tatva_connect.search.shortcuts.shortcuts',
    cache: 'tatva-shortcuts',
    initialData: [],
    auto: true,
    transform: (data) => data?.shortcuts || [],
  })

  async function reload() {
    await shortcuts.reload()
  }

  return { shortcuts, reload }
})
