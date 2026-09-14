<!-- TATVA: the ONE lead-reference cell for Tasks, Call Logs and Notes — a real anchor chip; on desktop a hover opens the lead card, which fetches only once open. -->
<template>
  <Popover
    v-if="docname"
    trigger="hover"
    placement="right-start"
    :hover-delay="0.4"
    :offset="4"
    :show="previewable ? undefined : false"
    class="max-w-full"
  >
    <template #target>
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
    </template>
    <template #body>
      <LeadPreview :name="docname" />
    </template>
  </Popover>
</template>

<script setup>
import ContactIcon from '@/components/Icons/ContactIcon.vue'
import ArrowUpRightIcon from '@/components/Icons/ArrowUpRightIcon.vue'
import LeadPreview from '@/tatva/LeadPreview.vue'
import { linkTitle, linkTargetDoctype } from '@/tatva/linkTitle'
import { isMobileView } from '@/composables/settings'
import { Badge, Popover } from 'frappe-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  value: { type: [String, Number], default: '' },
  column: { type: Object, default: () => ({}) },
  row: { type: Object, default: () => ({}) },
  // The list resource, read for its `_link_titles` map and never fetched from.
  list: { type: Object, default: () => ({}) },
})

const router = useRouter()

const docname = computed(() => props.value ?? '')
const doctype = computed(() => linkTargetDoctype(props.column, props.row))

// Desktop only and lead only; `show` held false keeps the Popover shut, so a tap is just the anchor.
const previewable = computed(() => doctype.value === 'CRM Lead' && !isMobileView.value)

const label = computed(() => linkTitle(props.value, props.column, props.list, props.row) || docname.value)

const href = computed(() => {
  const isDeal = doctype.value === 'CRM Deal'
  return router.resolve({
    name: isDeal ? 'Deal' : 'Lead',
    params: isDeal ? { dealId: docname.value } : { leadId: docname.value },
  }).href
})
</script>
