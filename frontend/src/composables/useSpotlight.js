import { showGlobalSearch } from '@/composables/settings'
import { smartViewsStore } from '@/stores/smartViews'
import { tabIcon } from '@/tatva/smartViewFormat'
import { useStorage } from '@vueuse/core'
import { createResource } from 'frappe-ui'
import { computed, ref, watch } from 'vue'

// The surfaces, in tab order: this app's own setup, then patients, then files, then the other app.
export const ALL = 'all'
export const SHORTCUTS = 'shortcuts'
export const INSIGHTS = 'insights'
export const LEAD = 'CRM Lead'
export const FILE = 'File'

const TAB_LABEL = {
  [ALL]: 'All',
  [SHORTCUTS]: 'Shortcuts',
  [INSIGHTS]: 'Insights',
  [LEAD]: 'Leads',
  [FILE]: 'Files',
}

const PAGE = 20
// ONE cap for every preview All shows: recents, smart views, each shortcut group. Depth lives in a tab.
const PREVIEW = 5
const RECENTS_MAX = 10
const DEBOUNCE_MS = 250

const KIND_SMART_VIEW = 'Smart View'
// Insights is another app behind its own roles, so it gets a surface rather than a line in this one.
const KIND_DASHBOARD = 'Dashboard'

// What a row needs to RENDER and OPEN — never the query's own output, and never a value that can drift.
const KEEP = [
  'doctype', 'name', 'lead', 'tab', 'file_url', 'lead_name',
  'isShortcut', 'kind', 'label', 'route', 'external', 'icon',
]

function keyOf(hit) {
  return hit.isShortcut ? hit.kind + ':' + hit.label : hit.doctype + ':' + hit.name
}

function keepable(hit) {
  const out = { title: (hit.title || '').replace(/<\/?mark>/g, '') }
  for (const key of KEEP) if (hit[key] != null) out[key] = hit[key]
  return out
}

const groupOf = (row) => row.heading || row.group || ''

// ONE cap for every group of named things: five, then a row that opens the rest. Records are cut server-side.
function capped(rows, expanded) {
  const total = {}
  for (const row of rows) total[groupOf(row)] = (total[groupOf(row)] || 0) + 1
  const shown = {}
  const out = []
  for (const row of rows) {
    const group = groupOf(row)
    shown[group] = (shown[group] || 0) + 1
    if (expanded.has(group) || shown[group] <= PREVIEW) out.push(row)
    else if (shown[group] === PREVIEW + 1) out.push({ isMore: true, group, total: total[group] })
  }
  return out
}

/**
 * The spotlight's state: what was typed, which surface is showing, and what to draw.
 *
 * It lives here rather than in the panel so GlobalSearch.vue stays about the panel — the overlay, the
 * keyboard and where a hit routes to.
 *
 * AT REST IT SHOWS MEMORY, NEVER INVENTORY: the last things this person opened, then the tabs they work
 * out of. A workflow or a workspace is reachable by name and is never on screen unasked — a resting list
 * of everything that exists is a directory, and nobody opens a spotlight to read one.
 */
export function useSpotlight() {
  const query = ref('')
  const tab = ref(ALL)
  const selected = ref(0)
  const recents = useStorage('spotlightRecents', [])
  // Which groups the reader opened. A new question, or a new visit, is answered at the resting shape.
  const expanded = ref(new Set())
  const smartViews = smartViewsStore()

  // Rendered from THIS, never resource.data: a slow answer for "ab" must not land after a fast "abc".
  const records = ref(null)
  let generation = 0
  let timer = null

  const searching = computed(() => !!query.value.trim())
  const wantsRecords = computed(() => tab.value === ALL || tab.value === LEAD || tab.value === FILE)
  const wantsShortcuts = computed(() => tab.value !== LEAD && tab.value !== FILE)

  const recordResource = createResource({
    url: 'tatva_connect.search.api.search',
    auto: false,
    makeParams: () => ({
      query: query.value.trim(),
      // All asks for both kinds and a fair share of each; a single-kind tab asks the index to narrow.
      type: tab.value === ALL ? null : tab.value,
      per_type: tab.value === ALL ? PREVIEW : null,
      limit: PAGE,
    }),
  })

  // Named setup, not a query: cached once the way telephony.js and whatsapp.js cache a standing answer.
  const shortcutResource = createResource({
    url: 'tatva_connect.search.shortcuts.shortcuts',
    cache: 'Spotlight Shortcuts',
    auto: true,
  })

  // The store the tabs bar reads, reloaded on create/delete/reorder/share — one list, never a second fetch.
  const smartViewShortcuts = computed(() =>
    (smartViews.views.data || []).map((view) => ({
      isShortcut: true,
      kind: KIND_SMART_VIEW,
      group: __('Smart Views'),
      label: view.label || view.name,
      // The ONE icon rule, borrowed whole: a view wears what its tab wears, never a second answer.
      icon: tabIcon(view),
      context: view.base_object || '',
      route: { name: 'SmartViews', query: { view: view.name } },
      external: false,
    })),
  )

  // Taken at REQUEST time and checked in onSuccess, so a stale answer returns to nothing.
  function ask() {
    const mine = ++generation
    if (!wantsRecords.value) return
    recordResource.submit(null, {
      onSuccess: (data) => {
        if (mine !== generation) return
        records.value = data
        selected.value = 0
      },
    })
  }

  // Retires the RECORD lane only: the shortcut list is cached and standing, never part of a query.
  function cancel() {
    clearTimeout(timer)
    timer = null
    generation++
    records.value = null
    recordResource.reset()
  }

  // Only the record lane needs a query; an empty box still answers with what this person opened last.
  watch(query, () => {
    selected.value = 0
    clearTimeout(timer)
    expanded.value = new Set()
    if (!query.value.trim()) return cancel()
    timer = setTimeout(ask, DEBOUNCE_MS)
  })

  // The tab is part of the question: ask again at once, cancelling the armed request rather than racing it.
  watch(tab, () => {
    selected.value = 0
    clearTimeout(timer)
    expanded.value = new Set()
    if (query.value.trim()) ask()
  })

  watch(showGlobalSearch, (open) => {
    if (!open) return cancel()
    query.value = ''
    tab.value = ALL
    expanded.value = new Set()
    cancel()
    // The one moment this list can be wrong; cached rows stay on screen while it re-answers, so nothing blinks.
    shortcutResource.reload()
  })

  const hits = computed(() => (wantsRecords.value ? records.value?.results || [] : []))

  // A record run is cut server-side, so its "show all" hands over to the tab that holds the rest.
  const hitRows = computed(() => {
    if (tab.value !== ALL) return hits.value
    const totals = records.value?.totals || {}
    const out = []
    let run = null
    const closeRun = () => {
      if (run && (totals[run] || 0) > PREVIEW)
        out.push({ isMore: true, doctype: run, tab: run, total: totals[run] })
    }
    for (const hit of hits.value) {
      if (hit.doctype !== run) {
        closeRun()
        run = hit.doctype
      }
      out.push(hit)
    }
    closeRun()
    return out
  })

  // Everything this person can open, from both lanes: the live store and the cached endpoint.
  const offered = computed(() => [
    ...smartViewShortcuts.value,
    ...(shortcutResource.data?.shortcuts || []).map((s) => ({ ...s, isShortcut: true })),
  ])

  // A row belongs to ONE surface: Insights is its own tab, so Shortcuts stays this app's own setup.
  const onTab = (s) =>
    tab.value === ALL || (s.kind === KIND_DASHBOARD ? tab.value === INSIGHTS : tab.value === SHORTCUTS)

  // Narrowed HERE by containment, so `Engagement` finds `GF Inside Sales — Engagement`; a prefix would not.
  const shortcuts = computed(() => {
    if (!wantsShortcuts.value) return []
    const term = query.value.trim().toLowerCase()
    return offered.value.filter((s) => onTab(s) && s.label.toLowerCase().includes(term))
  })

  // No Insights role, or nothing shared, means the source returned nothing and the tab is never drawn.
  const tabs = computed(() => {
    const hasInsights = offered.value.some((s) => s.kind === KIND_DASHBOARD)
    return [ALL, SHORTCUTS, LEAD, FILE, ...(hasInsights ? [INSIGHTS] : [])].map((value) => ({
      label: __(TAB_LABEL[value]),
      value,
    }))
  })

  // A tab can go away under the person standing on it — Insights unshared, or the list arriving late.
  watch(tabs, (list) => {
    if (!list.some((t) => t.value === tab.value)) tab.value = ALL
  })

  // `heading` is the panel's word for a section — a record's `group` is its GRAIN group, never a heading.
  const restingRecents = computed(() =>
    recents.value
      .filter((hit) => (hit.isShortcut ? onTab(hit) : tab.value === ALL || hit.doctype === tab.value))
      .map((hit) => ({ ...hit, heading: __('Recent'), context: hit.kind })),
  )

  // What you opened, then the tabs you work out of; a row in Recent is dropped from the group below it.
  const resting = computed(() => {
    const recent = restingRecents.value
    const already = new Set(recent.map(keyOf))
    const below = (tab.value === ALL ? smartViewShortcuts.value : shortcuts.value).filter(
      (s) => !already.has(keyOf(s)),
    )
    return [...recent, ...below]
  })

  const rows = computed(() =>
    searching.value
      ? [...capped(shortcuts.value, expanded.value), ...hitRows.value]
      : capped(resting.value, expanded.value),
  )

  // Opening a group is a view change, not a navigation: the panel stays, and `selected` stays put.
  function expand(group) {
    expanded.value = new Set([...expanded.value, group])
  }

  function remember(hit) {
    if (hit.isMore) return
    const key = keyOf(hit)
    const rest = recents.value.filter((r) => keyOf(r) !== key)
    recents.value = [keepable(hit), ...rest].slice(0, RECENTS_MAX)
  }

  return {
    query,
    tab,
    tabs,
    selected,
    rows,
    remember,
    expand,
    searching,
    loading: computed(() => recordResource.loading),
    // The server's own reading — ready / too_short / building / disabled — so an empty list says WHY.
    status: computed(() => records.value?.status || ''),
    understood: computed(() => records.value?.understood || null),
    total: computed(() => records.value?.total || 0),
    totals: computed(() => records.value?.totals || {}),
    totalCapped: computed(() => !!records.value?.total_capped),
    cancel,
  }
}
