<!--
  TATVA: the hover card behind the lead badge — a CONTACT CARD, not a form.

  SIX THINGS, and the list is closed: name, phone, photo, stage, owner, source, grain. The server decides
  them (`tatva_connect/api/lead_preview.py`) and this renders what it is handed. It derives nothing (E2)
  and it is NOT driven by the side-panel layout, so an operator editing that layout cannot grow this card.

  THIS COMPONENT IS THE FETCH DISCIPLINE. `Tooltip` mounts its `#body` slot only while the card is open,
  so this component's `setup` IS the open event: nothing is fetched when a list loads, when a row renders,
  or when a mouse sweeps the column, and at most one card exists at a time so at most one request is ever
  in flight. There is no code enforcing that — it falls out of the hover delay plus `v-if`, which is why
  it cannot rot. Do not move the fetch up into `LeadCell.vue`.

  READ-ONLY, and deliberately so. The side panel proper is editable; a surface that appears on mouse-over
  and vanishes on mouse-out must never be a write surface.

  There is no hover on touch (H3), so on a phone this card simply does not exist — a tap on the badge
  already opens the lead, which is the whole of the mobile affordance. That is a decision, not an omission.

  A preview is decoration, so a refused or failed read is QUIET — no toast, no error styling, no retry —
  but it is not INVISIBLE. The frame holds its shape and says "No preview available". Rendering nothing
  was the first cut and it was wrong: the tooltip stays open, so content that unmounts under it collapses
  the box on screen, which reads as a flicker and looks broken. Silent means undemanding, not vanishing.
-->
<template>
  <!-- The frame is mounted for the WHOLE life of the card and never conditionally removed. Collapsing it
       when a read is refused is what made a hover read as "Loading… flicker… gone": the tooltip stays open,
       so content that unmounts under it leaves a box that shrinks to nothing on screen.

       WIDTH FITS THE CONTENT, within bounds. A fixed `w-72` clipped a long stage and wrapped the
       "Product Line" label onto two lines; the payload is a closed set of six short fields, so letting it
       size itself is safe and bounded — `min-w` keeps a sparse lead from looking cramped, `max-w` keeps a
       long stage from running across the screen, and `truncate` still catches whatever exceeds that. -->
  <div
    class="w-max min-w-[18rem] max-w-[24rem] overflow-hidden rounded-lg bg-surface-modal shadow-2xl ring-1 ring-outline-gray-2"
  >
    <!-- A skeleton at the real card's shape, so the box never resizes when the answer lands. -->
    <div v-if="pending" class="flex items-start gap-3 bg-surface-gray-2 p-3">
      <div class="size-9 shrink-0 animate-pulse rounded-full bg-surface-gray-3" />
      <div class="flex min-w-0 flex-1 flex-col gap-2 py-1">
        <div class="h-3 w-2/3 animate-pulse rounded bg-surface-gray-3" />
        <div class="h-3 w-1/2 animate-pulse rounded bg-surface-gray-3" />
      </div>
    </div>

    <!-- A refused or failed read. One muted line, no error styling, no retry: the reader is told the card
         has nothing rather than watching it disappear. -->
    <div v-else-if="!card" class="px-3 py-2.5 text-p-sm text-ink-gray-5">
      {{ __('No preview available') }}
    </div>

    <template v-else>
      <!-- The band. ONE neutral tint — a hue here would claim a meaning the card does not have.
           The avatar sits on a WHITE disc: its own empty-state fill is `surface-gray-2`, the same token as
           this band, so without the disc the two merge and the initial floats in a grey field. -->
      <div class="bg-surface-gray-2 p-3">
        <div class="flex items-start gap-3">
          <div class="shrink-0 rounded-full bg-surface-white p-0.5 ring-1 ring-outline-gray-2">
            <Avatar size="2xl" :label="card.title" :image="card.image" />
          </div>
          <div class="flex min-w-0 flex-col items-start gap-1">
            <div class="truncate text-base font-medium text-ink-gray-9">{{ card.title }}</div>
            <div v-if="card.phone" class="truncate text-p-sm text-ink-gray-6">{{ card.phone }}</div>
          </div>
        </div>
        <!-- The stage gets the band's FULL width, below the avatar row. Inside that row it shared the
             narrow right-hand column with the name and was clipped by the avatar's width. -->
        <TatvaStageBadge
          v-if="card.stage"
          :label="card.stage"
          :color="card.stage_color"
          class="mt-2"
        />
      </div>

      <!-- The body. Divided rows, not loose pairs — a card is read down its labels. -->
      <dl class="divide-y divide-outline-gray-1">
        <div v-if="owner" class="flex items-center gap-2 px-3 py-2">
          <dt class="w-24 shrink-0 whitespace-nowrap text-p-xs text-ink-gray-5">{{ __('Owner') }}</dt>
          <dd class="flex min-w-0 flex-1 items-center gap-1.5">
            <Avatar size="xs" :label="owner.full_name" :image="owner.user_image" class="shrink-0" />
            <span class="truncate text-p-sm text-ink-gray-8">{{ owner.full_name }}</span>
          </dd>
        </div>
        <div v-if="card.source" class="flex items-center gap-2 px-3 py-2">
          <dt class="w-24 shrink-0 whitespace-nowrap text-p-xs text-ink-gray-5">{{ __('Source') }}</dt>
          <dd class="min-w-0 flex-1 truncate text-p-sm text-ink-gray-8">{{ card.source }}</dd>
        </div>
        <!-- Product Line, Group and Program each get their OWN labelled row. They are three separate
             facts a rep reads individually, not one address — dot-joining them hid which was which. -->
        <div
          v-for="axis in card.grain"
          :key="axis.label"
          class="flex items-center gap-2 px-3 py-2"
        >
          <dt class="w-24 shrink-0 whitespace-nowrap text-p-xs text-ink-gray-5">{{ __(axis.label) }}</dt>
          <dd class="min-w-0 flex-1 truncate text-p-sm text-ink-gray-8">{{ axis.value }}</dd>
        </div>
      </dl>
    </template>
  </div>
</template>

<script setup>
import TatvaStageBadge from '@/tatva/TatvaStageBadge.vue'
import { ensureLeadPreview, knownLeadPreview } from '@/tatva/leadPreview'
import { usersStore } from '@/stores/users'
import { Avatar } from 'frappe-ui'
import { computed, onUnmounted, ref } from 'vue'

const props = defineProps({
  // The referenced doctype, read off the row by the badge. Only a lead has a card we answer for;
  // a Deal reference gets the badge and no card.
  doctype: { type: String, default: '' },
  // The lead this card is about. Fixed for the life of the card — a new badge is a new card.
  name: { type: [String, Number], default: '' },
})

// The memo answers on the FIRST FRAME for a lead already seen, so a re-hover paints and asks nothing.
const card = ref(knownLeadPreview(props.name))
const loading = ref(false)

// The card can close mid-flight. Unmounting is the WHOLE of the cleanup: the late response writes into
// nothing and rejects nothing, because the memo already swallowed the failure.
let open = true
onUnmounted(() => (open = false))

// `loading && !data`, never `loading` alone — the second would paint a spinner over the memo (F7/B5).
const pending = computed(() => loading.value && !card.value)

// The owner is an email on the wire. The browser's own users store turns it into a name and an avatar —
// the same store the Assigned To column reads, so a rep looks identical on every surface (E2).
//
// Resolved ONCE, where the payload lands — never in a computed. `getUser` SYNTHESISES and WRITES a
// fallback entry into its reactive map for an email it has not loaded (a disabled user, or one outside
// the CRM list), and that write inside a computed getter is a side effect in a pure context: it dirties
// the very dep the computed just read, costing an extra evaluation every time. The three other computed
// callers in this app pass no argument, so they only ever read the session user and never reach that
// branch. This one takes an arbitrary owner, so it can — which is why it resolves eagerly instead.
const { getUser } = usersStore()
const owner = ref(null)

function render(fetched) {
  card.value = fetched
  owner.value = fetched?.owner ? getUser(fetched.owner) : null
}

if (card.value) render(card.value)

if (props.doctype === 'CRM Lead' && props.name && !card.value) {
  loading.value = true
  ensureLeadPreview(props.name).then((fetched) => {
    if (!open) return
    if (fetched) render(fetched)
    loading.value = false
  })
}
</script>
