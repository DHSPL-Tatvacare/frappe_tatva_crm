<!-- eslint-disable vue/no-v-html -->
<!-- TATVA: spotlight result rows — one source of truth. Compact on desktop, roomier on mobile.
     Rows persist during a reload (no bounce); the server's own <mark> is what is highlighted. -->
<template>
  <div class="min-h-[8rem]">
    <template v-if="rows.length">
      <!-- One section per category; a heading is never selectable, so arrow keys walk one flat run. -->
      <section v-for="group in groups" :key="group.category">
        <div
          class="flex items-center justify-between px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-ink-gray-5"
        >
          <span>{{ __(group.category) }}</span>
          <span class="tabular-nums text-ink-gray-4">{{ group.total }}</span>
        </div>
        <ul>
          <li v-for="row in group.rows" :key="row.key">
            <TatvaResultRow
              :selected="row.index === selected"
              :dense="!isMobileView"
              @select="$emit('select', row.hit)"
              @hover="$emit('hover', row.index)"
            >
              <template #icon><Icon :icon="row.icon" class="size-4" /></template>
              <template #title><span v-html="row.titleHtml" /></template>
              <!-- ONE loop for the line under a title. A slot is plain text unless it says otherwise. -->
              <template v-if="row.slots" #meta>
                <span v-for="(slot, k) in row.slots" :key="k">
                  <span v-if="k" aria-hidden="true">&nbsp;·&nbsp;</span>
                  <span v-if="slot.label" class="text-ink-gray-4">{{ __(slot.label) }}:&nbsp;</span>
                  <mark v-if="slot.marked">{{ slot.value }}</mark>
                  <span v-else-if="slot.html" v-html="slot.value" />
                  <span v-else-if="slot.strong" class="font-medium text-ink-gray-7">{{ slot.value }}</span>
                  <template v-else>{{ slot.value }}</template>
                </span>
              </template>
              <template v-if="row.external" #trailing>
                <ExternalLinkIcon class="size-3.5" />
              </template>
            </TatvaResultRow>
          </li>
        </ul>
      </section>
    </template>

    <div v-else-if="loading" class="flex justify-center py-12">
      <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
    </div>
    <!-- Every empty state names what is searched and, once a query ran, the server's reason for nothing. -->
    <div v-else class="py-12 text-center text-sm text-ink-gray-5">{{ emptyMessage }}</div>
  </div>
</template>

<script setup>
import ExternalLinkIcon from '@/components/Icons/ExternalLinkIcon.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue' // TATVA: the deal tier's row icon
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import Icon from '@/components/Icon.vue'
import TatvaResultRow from '@/tatva/TatvaResultRow.vue'
import LucideTable2 from '~icons/lucide/table-2'
import LucideWorkflow from '~icons/lucide/workflow'
import LucideList from '~icons/lucide/list'
import LucideFunnelPlus from '~icons/lucide/funnel-plus'
import LucideChartNoAxesCombined from '~icons/lucide/chart-no-axes-combined'
import LucideLayoutPanelLeft from '~icons/lucide/layout-panel-left'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideArrowRight from '~icons/lucide/arrow-right'
import { isMobileView } from '@/composables/settings'
import { ALL, FILE, INSIGHTS, KIND, LEAD, SHORTCUTS } from '@/composables/useSpotlight'
import { sanitizeHTML } from '@/utils'
import { LoadingIndicator } from 'frappe-ui'
import { computed } from 'vue'

// `category` labels a run the SERVER already ordered; `one` is what a single row of this type is called.
const TYPE = {
  [LEAD]: { icon: LeadsIcon, category: 'Leads', one: 'Lead' },
  // TATVA: the deal tier — the same patient, its own record, so its own heading and its own shape.
  'CRM Deal': { icon: DealsIcon, category: 'Deals', one: 'Deal' },
  'FCRM Note': { icon: NoteIcon, category: 'Notes', one: 'Note' },
  [FILE]: { icon: AttachmentIcon, category: 'Attachments', one: 'File' },
}

// A doctype re-enabled in the backend must degrade to a plain row, never throw inside the v-for and blank the panel.
const FALLBACK = { icon: LucideList, category: 'Other', one: '' }

const props = defineProps({
  hits: { type: Array, default: () => [] },
  selected: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  query: { type: String, default: '' },
  // The endpoint's own reading: 'ready' | 'too_short' | 'building' | 'disabled'. It owns the query floor.
  status: { type: String, default: '' },
  // Which surface is showing, so an empty state can name it.
  tab: { type: String, default: ALL },
  // What each kind HAS, so a heading counts the group, not the rows drawn from it.
  totals: { type: Object, default: () => ({}) },
})
defineEmits(['select', 'hover'])

// FTS5 wrapped the real match server-side; only <mark> survives, because `content` is user-entered text.
const marked = (html) => sanitizeHTML(html || '', { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] })

// A file is titled by its own name and says whose it is: the patient, weighted, then their number.
function fileSlotsOf(h) {
  return [{ value: h.lead_name, strong: true }, { value: h.phone }].filter((s) => s.value)
}

// What this surface is called in a sentence — the word every empty state uses, so the tabs agree.
const SURFACE = {
  [ALL]: () => __('leads, files and shortcuts'),
  [SHORTCUTS]: () => __('shortcuts'),
  [INSIGHTS]: () => __('dashboards'),
  [LEAD]: () => __('leads'),
  [FILE]: () => __('files'),
}

// Surfaces the index never answers for: their empty state is "nothing matched", never "unavailable".
const LIVE = [SHORTCUTS, INSIGHTS]

const emptyMessage = computed(() => {
  const surface = (SURFACE[props.tab] || SURFACE[ALL])()
  if (!props.query.trim()) return __('Type to search {0}', [surface])
  // No number here: the endpoint owns the floor, and a copy of it in the client is a copy that drifts.
  if (props.status === 'too_short') return __('Keep typing to search {0}', [surface])
  if (props.status === 'building') return __('Search is still being prepared')
  // "No matching" ONLY where the index really answered; every other reading says unavailable.
  if (props.status === 'ready' || LIVE.includes(props.tab))
    return __('No matching {0} for “{1}”', [surface, props.query.trim()])
  return __('Search is unavailable')
})

// A lead's fixed slots, then the ID slot when the server says one was typed, then where it stands.
function slotsOf(h) {
  const ident = h.ident || null
  const slots = [
    // Phone is already a fixed slot, so a phone match marks that slot rather than repeating the number.
    { value: h.phone, marked: ident?.column === 'phone' },
    { value: h.vertical },
    { value: h.group },
    { value: h.program },
  ].filter((s) => s.value)
  if (ident && ident.column !== 'phone') slots.push({ label: ident.label, value: ident.value, marked: true })
  // The stage is the row's ONE emphasis; the owner is labelled instead, so two facts stop competing.
  slots.push({ value: h.stage, strong: true }, { label: 'Lead owner', value: h.lead_owner })
  return slots.filter((s) => s.value)
}

// The glyph a KIND wears. An individual saved thing wears its own instead, the way the tabs bar does.
const SHORTCUT_ICON = {
  [KIND.SMART_VIEW]: LucideTable2,
  [KIND.LIST_VIEW]: LucideList,
  [KIND.PRESET]: LucideFunnelPlus,
  [KIND.WORKFLOW]: LucideWorkflow,
  [KIND.WORKSPACE]: LucideLayoutPanelLeft,
  [KIND.DASHBOARD]: LucideChartNoAxesCombined,
}

// Three shapes, ONE contract; `one` is the fallback line, and only an action row leaves it empty.
function shortcutRow(hit) {
  return {
    key: hit.kind + ':' + hit.label,
    icon: hit.icon || SHORTCUT_ICON[hit.kind] || LucideList,
    // The heading already names the kind, so the line under a shortcut carries only what places it.
    category: hit.heading || hit.group,
    titleHtml: marked(hit.label),
    slots: hit.context ? [{ value: hit.context }] : [],
    one: hit.kind,
    external: hit.external,
  }
}

// Opens the rest of a group: a row like any other, named by doctype for records and by heading for the rest.
function moreRow(hit) {
  return {
    key: 'more:' + (hit.doctype || hit.group),
    icon: hit.tab ? LucideArrowRight : LucideChevronDown,
    category: hit.doctype ? (TYPE[hit.doctype] || FALLBACK).category : hit.group,
    titleHtml: __('Show all {0}', [hit.total]),
    slots: [],
    one: '',
    external: false,
  }
}

function recordRow(hit) {
  const type = TYPE[hit.doctype] || FALLBACK
  const isLead = hit.doctype === LEAD
  const isFile = hit.doctype === FILE
  return {
    key: hit.doctype + ':' + hit.name,
    icon: type.icon,
    // `heading`, never `group`: a lead's `group` is its GRAIN group and headed sections by programme.
    category: hit.heading || type.category,
    titleHtml: marked(hit.title),
    // A lead ignores `snippet` (identifiers), and a file's snippet IS its title — printing it twice.
    slots: isLead ? slotsOf(hit) : isFile ? fileSlotsOf(hit) : snippetSlots(hit),
    one: type.one,
    external: false,
  }
}

const snippetSlots = (hit) => (hit.snippet ? [{ value: marked(hit.snippet), html: true }] : [])

// ONE row model per RESPONSE, and ONE rule for the line under a title: what is known, else what the row IS.
const rows = computed(() =>
  props.hits.map((hit, index) => {
    const row = hit.isMore ? moreRow(hit) : hit.isShortcut ? shortcutRow(hit) : recordRow(hit)
    row.slots = row.slots.length ? row.slots : row.one ? [{ value: row.one }] : null
    // Its position in the FLAT list, so a grouped render still walks as one run under `selected`.
    return { ...row, hit, index }
  }),
)

// Runs of one category, already contiguous; the heading counts what the group HAS, not what is drawn.
const groups = computed(() => {
  const out = []
  for (const row of rows.value) {
    const last = out[out.length - 1]
    if (last && last.category === row.category) last.rows.push(row)
    else out.push({ category: row.category, rows: [row], total: 0 })
  }
  for (const group of out) {
    const more = group.rows.find((row) => row.hit.isMore)
    const doctype = group.rows.find((row) => !row.hit.isMore && row.hit.doctype)?.hit.doctype
    group.total = more?.hit.total ?? props.totals[doctype] ?? group.rows.length
  }
  return out
})
</script>

<style scoped>
/* Background and line-height only: padding or a radius splits a marked run out of its own word. */
:deep(mark) {
  background-color: var(--surface-amber-2);
  color: inherit;
}
</style>
