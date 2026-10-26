// TATVA: a list screen's rows, Helpdesk's `ticketListCommands.ts`: filter it, show mine, switch view, clear — applied through the list's own filter path.
import router from '@/router'
import { createResource, getCachedResource } from 'frappe-ui'
import { isGrainField } from '@/tatva/grainField'
import { LENS_CACHE_GENERATION } from '@/tatva/lensCache'
import { getMeta } from '@/stores/meta'
import { sessionStore } from '@/stores/session'
import { statusesStore } from '@/stores/statuses'
import { viewsStore } from '@/stores/views'
import { parseColor } from '@/utils'
import LucideCircleDot from '~icons/lucide/circle-dot'
import LucideFilterX from '~icons/lucide/filter-x'
import LucideFlag from '~icons/lucide/flag'
import LucideLayers from '~icons/lucide/layers'
import LucideLayoutList from '~icons/lucide/layout-list'
import LucideMegaphone from '~icons/lucide/megaphone'
import LucideUser from '~icons/lucide/user'
import { CONTEXT_WEIGHT, GROUP, loaded } from './paletteTypes'
import { listHandle } from './published'

// The list's own filter fields (Filter.vue's cache), which the server stamps with the grain values this person may filter by — no request of the palette's own.
function grainValues(doctype, field) {
  const fields = getCachedResource(['filterableFields', doctype, LENS_CACHE_GENERATION])?.data || []
  const found = fields.find((f) => f.fieldname === field)
  // A stage is filtered by its LABEL; the list engine reads it back as every stage key carrying it.
  return isGrainField(found) ? found.grain_options.map((value) => ({ value, label: value })) : []
}

// The filter bar's own lookup for a Link: Frappe's link search, which applies read permission and the field's User Permissions.
const leadSources = createResource({
  url: 'frappe.desk.search.search_link',
  params: { doctype: 'CRM Lead Source', txt: '', page_length: 500, reference_doctype: 'CRM Lead', link_fieldname: 'source' },
  cache: ['tatva:palette', 'CRM Lead Source'],
})
const sourceValues = () => (loaded(leadSources) || []).map((s) => ({ value: s.value, label: s.label || s.value }))

const dealStatuses = () =>
  (statusesStore().dealStatuses.data || []).map((s) => ({ value: s.name, label: s.name, dotClass: parseColor(s.color) }))

// One meta reader per doctype, made on first use: `getMeta` builds a resource per call, and the rows rebuild per keystroke.
const metas = {}
// A Select's own options, off the doctype meta, so a site that adds a status gets it here too.
function selectOptions(doctype, field) {
  const meta = (metas[doctype] ??= getMeta(doctype))
  const options = meta.doctypeMeta.value?.fields?.find((f) => f.fieldname === field)?.options || ''
  return options
    .split('\n')
    .filter(Boolean)
    .map((value) => ({ value, label: value }))
}

// Per list: the route it lives on, who "mine" is to it, and the option filters worth one keystroke.
const LIST = {
  'CRM Lead': {
    route: 'Leads',
    mine: 'Show leads assigned to me',
    assignField: '_assign',
    filters: [
      { field: 'custom_stage', title: 'Filter by stage', icon: LucideCircleDot, options: () => grainValues('CRM Lead', 'custom_stage') },
      // A programme filter only means something to a person working in more than one.
      { field: 'custom_current_program', title: 'Filter by program', icon: LucideLayers, min: 2, options: () => grainValues('CRM Lead', 'custom_current_program') },
      { field: 'source', title: 'Filter by source', icon: LucideMegaphone, options: sourceValues },
    ],
  },
  'CRM Deal': {
    route: 'Deals',
    mine: 'Show deals assigned to me',
    assignField: '_assign',
    filters: [{ field: 'status', title: 'Filter by status', icon: LucideCircleDot, options: dealStatuses }],
  },
  'CRM Task': {
    route: 'Tasks',
    mine: 'Show tasks assigned to me',
    assignField: 'assigned_to',
    filters: [
      { field: 'status', title: 'Filter by status', icon: LucideCircleDot, options: () => selectOptions('CRM Task', 'status') },
      { field: 'priority', title: 'Filter by priority', icon: LucideFlag, options: () => selectOptions('CRM Task', 'priority') },
    ],
  },
}

const row = (extra) => ({ group: GROUP.list, weight: CONTEXT_WEIGHT, ...extra })

export function listCommands(doctype) {
  const list = listHandle.value
  const config = LIST[doctype]
  if (!config || list?.doctype !== doctype) return []
  const active = list.filters()
  return [
    ...config.filters.flatMap((filter) => {
      const options = filter.options()
      if (options.length < (filter.min || 1)) return []
      return [
        row({
          id: `list-filter-${filter.field}`,
          title: __(filter.title),
          icon: filter.icon,
          // Live option names, so "interested" finds the stage filter as well as its title.
          keywords: options.map((o) => o.label).join(' '),
          children: () =>
            options.map((o) => ({
              id: `list-filter-${filter.field}-${o.value}`,
              title: __(o.label),
              group: filter.title,
              dotClass: o.dotClass,
              checked: active[filter.field] === o.value,
              perform: () => list.apply({ [filter.field]: o.value }),
            })),
        }),
      ]
    }),
    row({
      id: 'list-assigned-to-me',
      title: __(config.mine),
      icon: LucideUser,
      keywords: 'mine my assignment',
      perform: () => list.apply({ [config.assignField]: mineFilter(config.assignField) }),
    }),
    row({
      id: 'list-switch-view',
      title: __('Switch view'),
      icon: LucideLayoutList,
      keywords: 'saved public private pinned',
      children: () => viewChildren(doctype, config.route),
    }),
    ...(Object.keys(active).length
      ? [row({ id: 'list-clear-filters', title: __('Clear filters'), icon: LucideFilterX, keywords: 'reset remove all', perform: list.clear })]
      : []),
  ]
}

// `_assign` holds a JSON list, so it is asked what it contains; a task's assignee is one field.
function mineFilter(field) {
  const me = sessionStore().user
  return field === '_assign' ? ['LIKE', `%${me}%`] : me
}

// The default list, then this doctype's saved views, as the sidebar names them.
function viewChildren(doctype, route) {
  const current = String(router.currentRoute.value.query.view ?? '')
  const saved = (viewsStore().views.data || []).filter((v) => v.dt === doctype && !v.is_standard && v.label)
  return [
    {
      id: 'list-view-default',
      title: __('List'),
      group: 'Switch view',
      icon: LucideLayoutList,
      checked: !current,
      perform: () => router.push({ name: route, params: { viewType: 'list' } }),
    },
    ...saved.map((view) => ({
      id: `list-view-${view.name}`,
      title: view.label,
      subtitle: view.public ? __('Public') : view.pinned ? __('Pinned') : __('Private'),
      group: 'Switch view',
      icon: LucideLayoutList,
      checked: view.name === current,
      perform: () =>
        router.push({ name: view.route_name || route, params: { viewType: view.type || 'list' }, query: { view: view.name } }),
    })),
  ]
}
