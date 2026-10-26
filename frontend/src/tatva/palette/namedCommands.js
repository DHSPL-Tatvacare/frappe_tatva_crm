// TATVA: named setup as palette rows — smart views from their store, saved lists, workflows and dashboards from the shortcuts endpoint, which already gates each by permission.
import router from '@/router'
import { createResource } from 'frappe-ui'
import { smartViewsStore } from '@/stores/smartViews'
import { tabIcon } from '@/tatva/smartViewFormat'
import LucideChartNoAxesCombined from '~icons/lucide/chart-no-axes-combined'
import LucideLayoutPanelLeft from '~icons/lucide/layout-panel-left'
import LucideList from '~icons/lucide/list'
import LucideFunnelPlus from '~icons/lucide/funnel-plus'
import LucideTable2 from '~icons/lucide/table-2'
import LucideWorkflow from '~icons/lucide/workflow'
import { CONTEXT_WEIGHT, GROUP } from './paletteTypes'

// The server's words for a kind.
const DASHBOARD = 'Dashboard'
const ICON = {
  'Smart View': LucideTable2,
  'List View': LucideList,
  Preset: LucideFunnelPlus,
  Workflow: LucideWorkflow,
  Workspace: LucideLayoutPanelLeft,
  [DASHBOARD]: LucideChartNoAxesCombined,
}

// Named setup, not a query: cached, and re-read once per open so a just-shared dashboard shows.
const shortcuts = createResource({
  url: 'tatva_connect.search.shortcuts.shortcuts',
  cache: 'Spotlight Shortcuts',
})
export const refreshNamed = () => shortcuts.reload()

const open = (s) => (s.external ? window.open(s.route, '_blank', 'noopener') : router.push(s.route))

function shortcutCommand(s, extra) {
  return {
    id: `named-${s.kind}-${s.label}`,
    title: s.label,
    subtitle: s.context || '',
    group: s.group,
    icon: s.icon || ICON[s.kind] || LucideList,
    perform: () => open(s),
    ...extra,
  }
}

function smartViewCommand(view, extra) {
  return {
    id: `smart-view-${view.name}`,
    title: view.label || view.name,
    subtitle: view.base_object || '',
    group: 'Smart Views',
    icon: tabIcon(view),
    perform: () => router.push({ name: 'SmartViews', query: { view: view.name } }),
    ...extra,
  }
}

const smartViews = () => smartViewsStore().views.data || []

// Memory, not inventory: every named thing is reachable by typing its name, and never listed at rest.
export function namedCommands() {
  const typedOnly = { hideWhenEmpty: true }
  return [
    ...smartViews().map((view) => smartViewCommand(view, typedOnly)),
    ...(shortcuts.data?.shortcuts || []).map((s) => shortcutCommand(s, typedOnly)),
  ]
}

// On Smart Views: switch tab, the current one ticked — Helpdesk's "Switch view".
export function smartViewCommands() {
  const current = String(router.currentRoute.value.query.view ?? '')
  if (!smartViews().length) return []
  return [
    {
      id: 'smart-view-switch',
      title: __('Switch smart view'),
      group: GROUP.list,
      weight: CONTEXT_WEIGHT,
      icon: LucideTable2,
      keywords: 'tab view open',
      children: () =>
        smartViews().map((view) => smartViewCommand(view, { group: '', checked: view.name === current })),
    },
  ]
}

// On the Dashboard: the dashboards shared with this person, at rest.
export function dashboardCommands() {
  return (shortcuts.data?.shortcuts || [])
    .filter((s) => s.kind === DASHBOARD)
    // Same id as its typed-only twin, so the engine keeps this one and drops that one.
    .map((s) => shortcutCommand(s, { weight: CONTEXT_WEIGHT }))
}
