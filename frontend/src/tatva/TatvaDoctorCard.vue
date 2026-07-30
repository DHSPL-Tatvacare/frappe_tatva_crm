<!--
  TatvaDoctorCard — one doctor in the Near Me list, shaped like a contact card.

  ONE DIMENSION. Every card renders the SAME three rows whatever the data holds, so a territory list is a
  clean stack and not a ragged one: identity, address, then badges + actions sharing the last row. A
  missing address or a hidden grain badge collapses nothing — the row is always there.

    ┌──────────────────────────────────────────────┐
    │ (A)  Dr Anil Kumar                    1.5 km │  identity + distance
    │      Anil Kumar Clinic, HSR Layout, …        │  address, one line, truncated
    │      [New Lead] [Goodflip]        📞  🧭  ↗  │  badges left, actions right — ONE row
    └──────────────────────────────────────────────┘

  Pure presentation: distance/labels arrive server-side, the call/directions/lead wiring lives in the page.
  Clicking the body emits `select` (the page highlights this row and centres the map); the buttons emit
  `call` / `directions` / `open`.
-->
<template>
  <!-- C4: selected reads `bg-surface-gray-2`, the SAME token SmartViewSheet:39 uses for its active row —
       one selected state in the app. Array + ternary of whole class strings, as SmartViewTabs does it. -->
  <div
    class="flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors"
    :class="
      selected
        ? 'border-outline-gray-3 bg-surface-gray-2'
        : 'border-outline-gray-1 bg-surface-white hover:bg-surface-gray-1'
    "
    @click="emit('select', doctor)"
  >
    <!-- N-6: labelled by `image_label` (the lead's first_name) — the same key and rule the CRM's own lead
         list uses (LeadsListView.vue:74 / Leads.vue:451). The TITLE carries the salutation, so labelling
         with it drew "D" on every doctor in the territory. -->
    <Avatar
      :image="doctor.image"
      :label="doctor.image_label || doctor.title || doctor.name"
      size="lg"
      shape="circle"
      class="mt-0.5 shrink-0"
    />

    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <!-- ROW 1 — identity. The name yields, the distance does not (H2). -->
      <div class="flex items-baseline gap-2">
        <div class="min-w-0 flex-1 truncate text-base font-medium text-ink-gray-9">
          {{ doctor.title || doctor.name }}
        </div>
        <div
          v-if="distanceLabel"
          class="shrink-0 text-sm tabular-nums text-ink-gray-5"
        >
          {{ distanceLabel }}
        </div>
      </div>

      <!-- ROW 2 — address. Always rendered, so the card height never depends on the data. -->
      <div class="truncate text-sm text-ink-gray-6">
        {{ doctor.address || '—' }}
      </div>

      <!-- ROW 3 — what it is, and what you can do about it. Badges wrap-free on the left, actions right. -->
      <div class="mt-0.5 flex items-center gap-2">
        <div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <Badge v-if="doctor.stage" variant="subtle" theme="blue" size="sm" :label="doctor.stage" />
          <!-- C8: the grain is information only when the territory spans more than one business line. -->
          <Badge
            v-if="doctor.grain && showGrain"
            variant="outline"
            theme="gray"
            size="sm"
            :label="doctor.grain"
          />
        </div>

        <!-- C5: ABSENT, not disabled — the app's own rule, quoted in SmartViewList.vue: "a control that is
             offered and then refuses is worse than one that was never there." An icon-only subtle button
             looks identical enabled or disabled, so a rep tapped and nothing happened. Icon-only in ONE
             row keeps three actions inside 390px, which labels could not (H5). -->
        <div class="flex shrink-0 items-center gap-1.5" @click.stop>
          <Button
            v-if="doctor.mobile_no"
            variant="ghost"
            theme="gray"
            :tooltip="__('Call')"
            @click="emit('call', doctor)"
          >
            <template #icon><FeatherIcon name="phone" class="h-4 w-4" /></template>
          </Button>
          <Button
            v-if="doctor.lat != null && doctor.lng != null"
            variant="ghost"
            theme="gray"
            :tooltip="__('Directions')"
            @click="emit('directions', doctor)"
          >
            <template #icon><FeatherIcon name="navigation" class="h-4 w-4" /></template>
          </Button>
          <!-- N-1: the capability the retired Desk page had and this one lost. The page builds the href
               through the router and opens it in a new tab, so the rep keeps their place on the map. -->
          <Button
            variant="ghost"
            theme="gray"
            :tooltip="__('Open lead')"
            @click="emit('open', doctor)"
          >
            <template #icon><FeatherIcon name="external-link" class="h-4 w-4" /></template>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Avatar, Badge, Button, FeatherIcon } from 'frappe-ui'
import { computed } from 'vue'
import { formatDistance } from '@/utils'

const props = defineProps({
  doctor: { type: Object, required: true },
  selected: { type: Boolean, default: false }, // C4 — the one selected state, owned by the page
  showGrain: { type: Boolean, default: true }, // C8 — the page knows whether the territory is mixed
})

const emit = defineEmits(['call', 'directions', 'select', 'open'])

const distanceLabel = computed(() => {
  const m = props.doctor?.distance_m
  if (m == null) return ''
  // C8: zero metres is a MEANING ("you are standing here"), so it is worded here; the format is shared.
  if (m < 1) return __('Here')
  return formatDistance(m)
})
</script>
