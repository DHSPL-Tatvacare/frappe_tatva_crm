<!--
  TatvaStagePill — the lead header lifecycle button, grain-scoped.

  Replaces the native status <Dropdown> on the lead surface (pages/Lead.vue + pages/MobileLead.vue).
  Options come from ONE server resolver (tatva_connect.lead.leads.lead_stages) scoped to the lead's
  program; picking emits the chosen leaf sub-stage name, which the parent writes to custom_substage via
  triggerOnChange. The server validate (validate_stage) is the single fail-closed backstop and derives
  the read-only parent custom_stage. modelValue = the rep's pick (custom_substage); the button shows
  the option's display_label (the doctype title_field) — the `::` PK never reaches the UI. Pure
  presentation + one resource call — NO business logic.

  Lives in frontend/src/tatva/ (additive — never conflicts on upstream cherry-pick).
-->
<template>
  <Dropdown v-if="options.length" :options="dropdownOptions" placement="right">
    <template #default="{ open }">
      <Button :label="currentLabel" :iconRight="open ? 'chevron-up' : 'chevron-down'">
        <template #prefix>
          <IndicatorIcon :class="parseColor(currentColor)" />
        </template>
      </Button>
    </template>
  </Dropdown>
</template>

<script setup>
import { computed, h } from 'vue'
import { Dropdown, Button, createResource } from 'frappe-ui'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import { parseColor } from '@/utils'

const props = defineProps({
  lead: { type: String, default: '' },
  modelValue: { type: String, default: '' },
})
const emit = defineEmits(['change'])

// One resource; `cache` makes the tab-triggered remount (App.vue keys router-view on $route.fullPath)
// a CACHE HIT, not a refetch — the same C.3/C.4 defense DetailPanel uses. `auto:true` is the SINGLE
// trigger (no watch→reload, so no double-fetch). The pill only mounts once `doc` is ready (v-if in
// Lead.vue), so `lead` is always present here; a lead-to-lead change remounts the page → new cache key.
const stages = createResource({
  url: 'tatva_connect.lead.leads.lead_stages',
  cache: ['crm-lead-stages', props.lead],
  makeParams: () => ({ lead: props.lead }),
  auto: true,
})

const options = computed(() => stages.data || [])
const current = computed(() => options.value.find((s) => s.name === props.modelValue))
const currentColor = computed(() => current.value?.color || 'gray')

// display_label (the doctype's title_field) is the single source of the clean label; the composite
// `::` PK is the stored value and never reaches the UI.
const clean = (s) => s?.display_label || s?.stage || ''
const currentLabel = computed(() => clean(current.value) || __('Set stage'))

// Flat, clickable list (leaves-only per the server resolver) — no grouping headers.
const dropdownOptions = computed(() =>
  options.value.map((s) => ({
    label: clean(s),
    icon: () => h(IndicatorIcon, { class: parseColor(s.color || 'gray') }),
    onClick: () => emit('change', s.name),
  })),
)
</script>
