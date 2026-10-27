// TATVA: the ⌘K palette's one state machine, Helpdesk's `useCommandPalette.ts`: query + drill-down stack + the open lead → ranked, grouped rows.
import { createResource, toast } from 'frappe-ui'
import { computed, ref, shallowRef } from 'vue'
import { showGlobalSearch as isOpen } from '@/composables/settings'
import { buildRootCommands, recentLeadCommands } from './commands'
import { scoreCommand } from './fuzzyScore'
import { leadCommands } from './leadCommands'
import { GROUP } from './paletteTypes'
import { leadHandle } from './published'
import { SEARCH_URL, searchCommands } from './searchCommands'

// Module scope: the sidebar button, ⌘K and the dialog drive one instance.
export { isOpen }
export const query = ref('')

const stack = shallowRef([]) // drill-down levels, empty = root
const loadingChildren = ref(false)

export const breadcrumb = computed(() => stack.value.map((level) => level.title))
// The open levels, read-only, so a builder can find its own by `tag`.
export const levels = computed(() => stack.value)
export const depth = computed(() => stack.value.length)

// --- context: the open lead, published by its page, so it can never outlive it ----------------

const contextDismissed = ref(false)

export const context = computed(() => {
  const lead = leadHandle.value
  if (contextDismissed.value || !lead) return null
  return { id: lead.id, label: __('Lead'), title: lead.title() }
})

// Drops the chip and widens the list back out to every global row.
export function dismissContext() {
  contextDismissed.value = true
  query.value = ''
  clearSearch()
}

export function openPalette() {
  isOpen.value = true
}

export function closePalette() {
  isOpen.value = false
}

export function resetPalette() {
  stack.value = []
  query.value = ''
  contextDismissed.value = false
  clearSearch()
}

// Returns to the level at `count` deep, e.g. a builder after a condition is added.
export function popTo(count) {
  stack.value = stack.value.slice(0, Math.max(count, 0))
  query.value = ''
  clearSearch()
}

// Pops one drill-down level. Backspace on an empty query calls this.
export function back() {
  if (!stack.value.length) return
  stack.value = stack.value.slice(0, -1)
  query.value = ''
  clearSearch()
}

// A second Enter mid-await stacked a duplicate level.
let running = false

// Drills in when the row has children, otherwise closes the palette and performs it.
export async function run(command) {
  if (!command || running) return
  if (command.children) {
    loadingChildren.value = true
    running = true
    try {
      const commands = await command.children()
      stack.value = [...stack.value, { title: command.levelTitle || command.title, commands, tag: command.levelTag }]
      query.value = ''
      clearSearch()
    } catch (error) {
      // Surfaced: the row stays where it was and the toast says which list failed.
      toast.error(error?.messages?.[0] || __('Could not load {0}', [command.title]))
    } finally {
      loadingChildren.value = false
      running = false
    }
    return
  }
  // A `stay` row acts inside the palette (a builder step); every other closes it first, so the action lands on a clean screen.
  if (command.stay) return command.perform?.()
  closePalette()
  command.perform?.()
}

// --- the list ----------------------------------------------------------------------------------

// Frozen while closed: no rebuilds for people who never open it, and the rows stay through the close fade.
let lastGroups = []

export const groups = computed(() => {
  if (!isOpen.value) return lastGroups
  return (lastGroups = buildGroups())
})

function buildGroups() {
  const level = stack.value.at(-1)
  if (level) {
    // A single group's header only repeats the breadcrumb; Settings keeps its many.
    // A level given as a function is live: it re-reads its state (a builder's conditions) on every rebuild.
    const commands = typeof level.commands === 'function' ? level.commands() : level.commands
    const grouped = groupCommands(commands, query.value)
    return grouped.length === 1 ? grouped.map((group) => ({ ...group, title: '' })) : grouped
  }

  // The chip already says what the lead rows act on; named sections keep their headers.
  const scoped = context.value
    ? groupCommands(leadCommands(leadHandle.value), query.value).map((group) =>
        group.title === __(GROUP.lead) ? { ...group, title: '' } : group,
      )
    : []

  const term = query.value.trim()
  if (!term && context.value) return [...scoped, ...groupCommands(recentLeadCommands(), '')]
  if (!term) return groupCommands(globalCommands(), '')
  // Scope ranks, never gates: the lead's rows lead, and every global row stays reachable beneath.
  return [...scoped, ...groupCommands(globalCommands(), term)]
}

function globalCommands() {
  return [...buildRootCommands(query.value), ...searchCommands(searchResponse.value, query.value.trim())]
}

function groupCommands(source, term) {
  const typed = Boolean(term.trim())
  const seen = new Set()
  const matched = source
    // One row per id: a screen's own copy of a named row wins over the global one.
    .filter((command) => !seen.has(command.id) && seen.add(command.id))
    .filter((command) => typed || !command.hideWhenEmpty)
    .map((command, index) => ({ command, score: scoreCommand(command, term), index }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const byGroup = new Map()
  for (const { command } of matched) {
    if (!byGroup.has(command.group)) byGroup.set(command.group, [])
    byGroup.get(command.group).push(command)
  }
  return [...byGroup].map(([title, items]) => ({ title: title ? __(title) : '', items }))
}

export const flatItems = computed(() => groups.value.flatMap((g) => g.items))
export const isLoading = computed(() => loadingChildren.value || searchLoading.value)

// --- record search -----------------------------------------------------------------------------

export const searchResponse = shallowRef(null)
const searchLoading = ref(false)
let latestSearchToken = 0
let timer = null

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250
const PER_TYPE = 5
const LIMIT = 20

const searchResource = createResource({ url: SEARCH_URL })

// Helpdesk's search block; the timer is kept rather than `useDebounceFn`, which cannot cancel a call already armed.
async function search(term, token) {
  let response = null
  try {
    response = await searchResource.submit({ query: term, per_type: PER_TYPE, limit: LIMIT })
  } catch {
    // Surfaced: a failed search reads as "Search is unavailable", never as "no such patient".
  }
  if (token !== latestSearchToken) return // a newer keystroke won
  searchResponse.value = response
  searchLoading.value = false
}

// The token advances on every change and the armed request is cancelled, so nothing lands under a newer query.
export function onQueryChange(term) {
  // TextInput emits on `input` and again on `change` (blur); the same words must not re-arm a request.
  if (term === query.value) return
  query.value = term
  latestSearchToken += 1
  clearTimeout(timer)
  const trimmed = term.trim()
  if (stack.value.length || trimmed.length < MIN_QUERY_LENGTH) {
    searchResponse.value = null
    searchLoading.value = false
    return
  }
  // Old rows stay until new ones land; clearing here blanked the list per keystroke.
  searchLoading.value = true
  const token = latestSearchToken
  timer = setTimeout(() => search(trimmed, token), DEBOUNCE_MS)
}

// Drops the current results and any request armed or in flight.
export function clearSearch() {
  latestSearchToken += 1
  clearTimeout(timer)
  searchResponse.value = null
  searchLoading.value = false
}
