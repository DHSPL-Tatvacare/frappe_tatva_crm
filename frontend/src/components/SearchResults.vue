<!-- eslint-disable vue/no-v-html -->
<!-- TATVA: spotlight result rows — one source of truth. Compact on desktop, roomier on mobile.
     Rows persist during a reload (no bounce); the server's own <mark> is what is highlighted. -->
<template>
  <div class="min-h-[8rem]">
    <template v-if="rows.length">
      <!-- One section per category. The heading names a run the SERVER already produced — nothing is
           re-sorted here, and a heading is never selectable, so arrow keys walk the rows in one flat run. -->
      <section v-for="group in groups" :key="group.category">
        <div
          class="flex items-center justify-between px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-ink-gray-5"
        >
          <span>{{ __(group.category) }}</span>
          <span class="tabular-nums text-ink-gray-4">{{ group.rows.length }}</span>
        </div>
        <ul>
          <li v-for="row in group.rows" :key="row.key">
        <button
          class="flex w-full gap-3 px-4 text-left transition-colors"
          :class="[
            row.index === selected ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-2',
            isMobileView ? 'items-start py-3' : 'items-center py-2.5',
          ]"
          @click="$emit('select', row.hit)"
          @mouseenter="$emit('hover', row.index)"
        >
          <!-- Neutral type tile — the CATEGORY HEADING names the type now, so the tile only carries shape. -->
          <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg" :class="row.tile">
            <component :is="row.icon" v-if="row.icon" class="size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-ink-gray-9" v-html="row.titleHtml" />
              <!-- The ONE shared stage badge, same renderer as the lead hover card. -->
              <TatvaStageBadge :label="row.stage" :color="row.stageColor" class="shrink-0" />
            </div>
            <!-- A lead's own line: four fixed slots, then the ID slot when the server says one was typed.
                 Plain interpolation — a metadata value is never markup, and the mark wraps a WHOLE value. -->
            <div v-if="row.slots" class="mt-0.5 line-clamp-2 text-xs text-ink-gray-5">
              <span v-for="(slot, k) in row.slots" :key="k">
                <span v-if="k" aria-hidden="true">&nbsp;·&nbsp;</span>
                <span v-if="slot.label" class="text-ink-gray-4">{{ __(slot.label) }}:&nbsp;</span>
                <mark v-if="slot.marked">{{ slot.value }}</mark>
                <template v-else>{{ slot.value }}</template>
              </span>
            </div>
            <div v-else class="mt-0.5 line-clamp-2 text-xs text-ink-gray-5" v-html="row.snippetHtml" />
            <Badge
              v-if="isMobileView && row.assignee"
              :label="row.assignee"
              theme="green"
              variant="subtle"
              size="sm"
              class="mt-1.5"
            />
          </div>
          <!-- Desktop: assignee on the right. -->
          <Badge
            v-if="!isMobileView && row.assignee"
            :label="row.assignee"
            theme="green"
            variant="subtle"
            size="sm"
            class="shrink-0"
          />
        </button>
          </li>
        </ul>
      </section>
    </template>

    <div v-else-if="loading" class="flex justify-center py-12">
      <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
    </div>
    <!-- Nothing asked yet, or the server says too little was typed. It owns that rule; this only renders it. -->
    <div v-else-if="!status || status === 'too_short'" class="py-12 text-center text-sm text-ink-gray-5">
      {{ __('Type to search') }}
    </div>
    <!-- An index that is absent or mid-build is not a no-match; saying "No results" reads as a broken search. -->
    <div v-else-if="status === 'building'" class="py-12 text-center text-sm text-ink-gray-5">
      {{ __('Search is still being prepared. Results will appear shortly.') }}
    </div>
    <!-- "No results" is claimed ONLY for the status that means the index really answered. Every other reading —
         switched off, or one this build has never heard of — says unavailable, never a false authoritative empty. -->
    <div v-else-if="status === 'ready'" class="py-12 text-center text-sm text-ink-gray-5">
      {{ __('No results for') }} “{{ query.trim() }}”
    </div>
    <div v-else class="py-12 text-center text-sm text-ink-gray-5">
      {{ __('Search is unavailable right now.') }}
    </div>
  </div>
</template>

<script setup>
import AttachmentIcon from '@/components/Icons/AttachmentIcon.vue'
import LeadsIcon from '@/components/Icons/LeadsIcon.vue'
import DealsIcon from '@/components/Icons/DealsIcon.vue' // TATVA: the deal tier's row icon
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import { isMobileView } from '@/composables/settings'
import { sanitizeHTML } from '@/utils'
import TatvaStageBadge from '@/tatva/TatvaStageBadge.vue'
import { Badge, LoadingIndicator } from 'frappe-ui'
import { computed } from 'vue'

// NEUTRAL TILES, decided 2026-07-31. The tiles used to carry a hue each, which spent colour on a fact the
// CATEGORY HEADING now states in words — and left no colour free for the one thing that has a real meaning,
// the stage. Icon shape distinguishes the type; colour is reserved. `ActivityCard.vue` reads the same way.
// `gray-3`, ONE STEP DARKER than the row's hover/selected `gray-2` — a tile that shares its row's active
// token disappears the moment the row is hovered, which is exactly what happened at `gray-2`. The same
// one-step rule the activity card already follows: its rows hover to `gray-1` and its tiles are `gray-2`.
const NEUTRAL = 'bg-surface-gray-3 text-ink-gray-7'

// The heading each category shows. Server order is Leads -> Notes -> Files and is already strict (the
// doctype tier dominates every other scoring factor), so this labels a grouping that already exists — it
// never reorders, and keyboard nav stays a flat run.
const TYPE = {
  'CRM Lead': { icon: LeadsIcon, tile: NEUTRAL, category: 'Leads' },
  // TATVA: the deal tier — the same patient, its own record, so its own heading and its own shape.
  'CRM Deal': { icon: DealsIcon, tile: NEUTRAL, category: 'Deals' },
  'FCRM Note': { icon: NoteIcon, tile: NEUTRAL, category: 'Notes' },
  File: { icon: AttachmentIcon, tile: NEUTRAL, category: 'Attachments' },
}

// A doctype re-enabled in the backend must degrade to a plain row, never throw inside the v-for and blank the panel.
const FALLBACK = { icon: null, tile: NEUTRAL, category: 'Other' }

const props = defineProps({
  hits: { type: Array, default: () => [] },
  selected: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  query: { type: String, default: '' },
  // The endpoint's own reading: 'ready' | 'too_short' | 'building' | 'disabled'. It owns the query floor.
  status: { type: String, default: '' },
})
defineEmits(['select', 'hover'])

// Render what FTS5 really matched. highlight()/snippet() already wrapped it server-side, including the prefix
// hits and spelling expansions a client regex on the typed term cannot reproduce ("rames" marks "Ramesh").
// Only <mark> survives: `content` carries user-entered note text.
const marked = (html) => sanitizeHTML(html || '', { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] })

// Four fixed slots, always in this order, then ONE dynamic slot: the unique ID the server says was typed. A
// unique ID is INPUT — it is shown here and nowhere else, whole, so no fragment of one can ever render.
function slotsOf(h) {
  const ident = h.ident || null
  const slots = [
    // Phone is already a fixed slot, so a phone match marks that slot in place rather than repeating the number.
    { value: h.phone, marked: ident?.column === 'phone' },
    { value: h.vertical },
    { value: h.group },
    { value: h.program },
  ].filter((s) => s.value)
  if (ident && ident.column !== 'phone') slots.push({ label: ident.label, value: ident.value, marked: true })
  return slots
}

// ONE row model per RESPONSE. marked() is DOMPurify, and calling it from inside the v-for re-sanitised every row
// on every hover and arrow key — the template reads `selected` there too, so ~20-40 sanitise passes per move.
const rows = computed(() =>
  props.hits.map((hit, index) => {
    const type = TYPE[hit.doctype] || FALLBACK
    const isLead = hit.doctype === 'CRM Lead'
    return {
      hit,
      // The row's position in the FLAT list, so a grouped render still maps to the parent's `selected`
      // index and arrow keys walk the results in one run rather than per group.
      index,
      key: hit.doctype + ':' + hit.name,
      tile: type.tile,
      icon: type.icon,
      category: type.category,
      // The lead's STAGE, from the one shared reading — never its status; they are different questions.
      stage: hit.stage,
      // The stage master's own colour, indexed beside the label so the shared badge renders identically
      // here and on the hover card. Blank is normal and renders neutral.
      stageColor: hit.stage_color || '',
      assignee: hit.assignee,
      titleHtml: marked(hit.title),
      // A lead row ignores `snippet` outright, so a wall of identifiers cannot come back through the server.
      snippetHtml: isLead ? '' : marked(hit.snippet),
      slots: isLead ? slotsOf(hit) : null,
    }
  }),
)

// The rows cut into runs of one category. The SERVER already orders by doctype with a weight that
// dominates every other scoring factor, so a run is contiguous by construction — this groups what is
// already grouped and never re-sorts. Each row keeps its flat `index`, so selection is unaffected.
const groups = computed(() => {
  const out = []
  for (const row of rows.value) {
    const last = out[out.length - 1]
    if (last && last.category === row.category) last.rows.push(row)
    else out.push({ category: row.category, rows: [row] })
  }
  return out
})
</script>

<style scoped>
/* Match highlight — a yellow wash (Frappe amber token) that keeps the text's own readable colour. Background
   and inherited line-height only: padding, a radius or a margin would visually split a marked run out of its
   own word, which is what made a prefix match read as broken. Overflow is line-clamped, never cut mid-token. */
:deep(mark) {
  background-color: var(--surface-amber-2);
  color: inherit;
}
</style>
