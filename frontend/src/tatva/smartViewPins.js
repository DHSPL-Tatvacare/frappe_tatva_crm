import { computed } from 'vue'
import { smartViewsStore } from '@/stores/smartViews'
import { tabIcon } from '@/tatva/smartViewFormat'

// The person's pinned Smart Views as sidebar links, in their own tab order; both sidebars read this one list.
export function useSmartViewPins() {
  const store = smartViewsStore()
  return computed(() =>
    (store.views.data || [])
      .filter((view) => view.pinned)
      .map((view) => ({
        label: view.label,
        icon: tabIcon(view),
        to: { name: 'SmartViews', query: { view: view.name } },
      })),
  )
}
