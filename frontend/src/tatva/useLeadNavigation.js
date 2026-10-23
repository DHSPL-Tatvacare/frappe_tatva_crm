import { getCachedResource } from 'frappe-ui'
import { useRoute, useRouter } from 'vue-router'

// Steps to the neighbouring lead of the list view the rep came from, off that view's cached rows (ViewControls' cache key) — no fetch.
export function useLeadNavigation() {
  const route = useRoute()
  const router = useRouter()

  function step(by) {
    const list = getCachedResource(['CRM Lead', route.query.view, route.query.viewType])
    if (list?.data?.view_type !== 'list') return
    const rows = list.data.data
    const at = rows.findIndex((row) => row.name === route.params.leadId)
    const next = at < 0 ? null : rows[at + by]
    if (next) router.push({ name: 'Lead', params: { leadId: next.name }, query: route.query })
  }

  return { next: () => step(1), previous: () => step(-1) }
}
