<!--
  TATVA: the ONE lead-reference cell for every listing page (Tasks, Call Logs, Notes).
  A lead reads as a person-shaped chip — icon, name, pop-out arrow — and the whole chip is a real anchor,
  so the arrow means what it draws and the browser's own new-tab gestures work with no code.
  The name is read from the `_link_titles` map the list already delivered; this component fetches nothing.
  The hover card hangs off it and does the same — the fetch lives in `LeadPreview.vue`, never here.
  Not `opacity-0 group-hover` — there is no hover on touch and the control must stay reachable (H3).
-->
<template>
  <!-- The card lives in `#body`, which Tooltip mounts only while it is open — so the badge itself still
       fetches nothing, and `disabled` keeps a Deal reference exactly the bare anchor it is today. -->
  <!-- arrowClass: Tooltip's default is `fill-surface-gray-7`, a near-black wedge sized for its own dark
       text bubble. The card is a light surface, so the arrow must be that surface or it reads as a black
       spike pointing at the card. -->
  <Tooltip
    v-if="docname"
    placement="right"
    arrow-class="fill-surface-modal"
    :disabled="!previewable"
  >
    <a :href="href" target="_blank" class="inline-flex max-w-full" @click.stop>
      <Badge variant="subtle" theme="gray" size="md" class="max-w-full">
        <template #prefix>
          <ContactIcon class="size-3 text-ink-gray-5" />
        </template>
        <span class="truncate">{{ label }}</span>
        <template #suffix>
          <ArrowUpRightIcon class="size-3 text-ink-gray-5" />
        </template>
      </Badge>
    </a>
    <template #body>
      <LeadPreview :doctype="doctype" :name="docname" />
    </template>
  </Tooltip>
</template>

<script setup>
import ContactIcon from '@/components/Icons/ContactIcon.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import LeadPreview from '@/tatva/LeadPreview.vue'
import { linkTitle, linkTargetDoctype } from '@/tatva/linkTitle'
import { isMobileView } from '@/composables/settings'
import { Badge, Tooltip } from 'frappe-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  // The cell's value: the referenced record's name, exactly as the list delivered it.
  value: { type: [String, Number], default: '' },
  column: { type: Object, default: () => ({}) },
  row: { type: Object, default: () => ({}) },
  // The list resource, for its `_link_titles` map. Never fetched from, only read.
  list: { type: Object, default: () => ({}) },
})

const router = useRouter()

const docname = computed(() => props.value ?? '')

// A Dynamic Link's target lives on the row; the one resolver in linkTitle.js decides, never this file.
const doctype = computed(() => linkTargetDoctype(props.column, props.row))

// A card is offered only for a LEAD, and only where hover exists. Reads the `doctype` COMPUTED above —
// there is no `doctype` prop, and referencing one silently disabled every tooltip. On touch `disabled`
// keeps Tooltip from mounting any trigger behaviour at all, so a tap is just the anchor: no card, no
// ghost tooltip left after the tap, nothing between the finger and the link (H3).
const previewable = computed(() => doctype.value === 'CRM Lead' && !isMobileView.value)

// The title the server already shipped; the raw key stands in when the target declares no title field.
const label = computed(
  () => linkTitle(props.value, props.column, props.list, props.row) || docname.value,
)

const href = computed(() => {
  const isDeal = doctype.value === 'CRM Deal'
  return router.resolve({
    name: isDeal ? 'Deal' : 'Lead',
    params: isDeal ? { dealId: docname.value } : { leadId: docname.value },
  }).href
})
</script>
