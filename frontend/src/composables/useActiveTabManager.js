import { ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebounceFn, useStorage } from '@vueuse/core'

// TATVA: keep the active tab visible in the horizontal tab strip. Selecting a tab changes the route
// hash; router-view is keyed on fullPath (App.vue), so the whole page REMOUNTS and the strip's
// scrollLeft resets to 0 — on mobile that throws you back to the first tab and you must scroll to find
// where you were. Re-scroll the active tab into view (no-op when it's already visible, so desktop and
// the first tab are unaffected). Applies to every tab, native and ours.
function scrollActiveTabIntoView() {
  nextTick(() => {
    const active = document.querySelector(
      '[role="tablist"] [role="tab"][data-state="active"], [role="tablist"] [role="tab"][aria-selected="true"]',
    )
    // Move ONLY the horizontal strip's scrollLeft — never scrollIntoView, which scrolls every ancestor
    // (both axes) and jumps the page.
    const strip = active?.closest('[role="tablist"]')
    if (!active || !strip) return
    const s = strip.getBoundingClientRect()
    const t = active.getBoundingClientRect()
    // Already fully visible (a non-overflowing desktop strip, or a tab in the middle): leave it alone.
    if (t.left >= s.left && t.right <= s.right) return
    // CENTRE it. Scrolling the minimum instead parks the tab you just picked hard against an edge, with
    // nothing after it — which reads as the strip having jumped away from you, and hides the tabs either
    // side that you were about to reach for. Clamped, so the first and last tabs settle naturally.
    const centred =
      strip.scrollLeft + (t.left - s.left) - (s.width - t.width) / 2
    strip.scrollLeft = Math.max(
      0,
      Math.min(centred, strip.scrollWidth - strip.clientWidth),
    )
  })
}

export function useActiveTabManager(tabs, storageKey) {
  const activeTab = useStorage(storageKey, 'activity')
  const route = useRoute()
  const router = useRouter()

  const changeTabTo = (tabName) => {
    let index = findTabIndex(tabName)
    if (index == -1) return
    tabIndex.value = index
  }

  const preserveLastVisitedTab = useDebounceFn((tabName) => {
    activeTab.value = tabName.toLowerCase()
  }, 300)

  function setActiveTabInUrl(tabName) {
    let hash = '#' + tabName.toLowerCase()
    if (route.hash === hash) return
    router.push({ ...route, hash })
  }

  function getActiveTabFromUrl() {
    return route.hash.replace('#', '')
  }

  function findTabIndex(tabName) {
    return tabs.value?.findIndex(
      (tabOptions) => tabOptions.name.toLowerCase() === tabName,
    )
  }

  function getTabIndex(tabName) {
    let index = findTabIndex(tabName)
    return index !== -1 ? index : 0 // Default to the first tab if not found
  }

  function getActiveTab() {
    let _activeTab = getActiveTabFromUrl()
    if (_activeTab) {
      let index = findTabIndex(_activeTab)
      if (index !== -1) {
        preserveLastVisitedTab(_activeTab)
        return index
      }
      return 0
    }

    let lastVisitedTab = activeTab.value
    if (lastVisitedTab) {
      return getTabIndex(lastVisitedTab)
    }

    return 0 // Default to the first tab if nothing is found
  }

  const tabIndex = ref(getActiveTab())
  scrollActiveTabIntoView() // TATVA: restore strip position on (re)mount — see note above.

  watch(tabIndex, (tabIndexValue) => {
    let currentTab = tabs.value?.[tabIndexValue].name
    setActiveTabInUrl(currentTab)
    preserveLastVisitedTab(currentTab)
    scrollActiveTabIntoView() // TATVA
  })

  watch(
    () => route.hash,
    (tabValue) => {
      if (!tabValue) return

      let tabName = tabValue.replace('#', '')
      let index = findTabIndex(tabName)
      if (index === -1) index = 0

      let currentTab = tabs.value?.[index].name
      preserveLastVisitedTab(currentTab)
      tabIndex.value = index
    },
  )

  watch(tabs, () => {
    tabIndex.value = getActiveTab()
  })

  return { tabIndex, changeTabTo }
}
