<!--
  TatvaStageBadge — the ONE read-only rendering of a lead's stage. Hover card + spotlight search.

  A SOLID BLUE, ONE COLOUR, EVERYWHERE. The stage is the single most meaningful thing on either surface —
  where this patient is in their journey — so it is the one element that earns colour, and everything
  around it stays neutral precisely so this one reads. Three weaker attempts failed first: a subtle grey
  Badge fills with `surface-gray-2`, the same token as the card's header band AND as a hovered search row,
  so it dissolved into both; an outline grey then read as a disabled chip; a subtle blue still sat too
  close to the grey it lives on.

  THE FILL IS PINNED, and the reason is measured, not stylistic. frappe-ui's own `solid` blue resolves to
  `bg-surface-blue-2` + `text-ink-blue-1`, which in this theme are rgb(230,244,255) and rgb(242,249,255) —
  a near-white ink on a pale blue fill, i.e. unreadable. `surface-blue-3` (rgb(0,123,224)) is the rich
  step, and `ink-white` on it is the contrast the solid variant was reaching for. Both are still design
  tokens resolved per theme; nothing here is a literal colour. The `!` prefix is this codebase's own way
  of overriding a frappe-ui component's internal class, used the same way on Button elsewhere.

  NOT a per-stage colour. `CRM Lead Stage.color` exists and is blank on all 292 rows, so a per-stage hue
  would render as nothing today and as a fruit salad the day someone half-fills it. If per-stage colour
  is ever wanted it is one theme swap here — the label and the master's colour already arrive together
  from `taxonomy.labels.stage_of`, which is also what feeds `TatvaStagePill` on the lead header.

  The `color` prop is accepted and deliberately unused for now; see above. It is kept because the payload
  already carries it and dropping it would mean changing two servers to add it back.
-->
<template>
  <Badge
    v-if="label"
    variant="solid"
    theme="blue"
    size="sm"
    class="max-w-full !bg-surface-blue-3 !text-ink-white"
  >
    <span class="truncate">{{ label }}</span>
  </Badge>
</template>

<script setup>
import { Badge } from 'frappe-ui'

defineProps({
  label: { type: String, default: '' },
  // The stage master's own colour. Carried by the payload, not rendered — see the note above.
  color: { type: String, default: '' },
})
</script>
