<!--
  TatvaStagePill — the lead header lifecycle button, grain-scoped.

  Replaces the native status <Dropdown> on the lead surface (pages/Lead.vue + pages/MobileLead.vue).
  Options come from ONE server resolver (tatva_connect.lead.leads.lead_stages) scoped to the lead's
  program; picking emits the chosen leaf sub-stage name, which the parent writes to custom_substage via
  triggerOnChange. The server validate (validate_stage) is the single fail-closed backstop and derives
  the parent custom_stage. modelValue = the rep's pick (custom_substage); mainStage = the derived parent
  (custom_stage), shown read-only. Pure presentation + one resource call — NO business logic.

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
import { computed, watch, h } from 'vue'
import { Dropdown, Button, createResource } from 'frappe-ui'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import { parseColor } from '@/utils'

const props = defineProps({
  lead: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  mainStage: { type: String, default: '' },
})
const emit = defineEmits(['change'])

const stages = createResource({
  url: 'tatva_connect.lead.leads.lead_stages',
  makeParams: () => ({ lead: props.lead }),
})
// ONE canonical trigger: an {immediate:true} watch loads as soon as `lead` is present (mount or a tick
// later) and on every lead-to-lead change. No `auto:true` — pairing it with this watch would double-fetch
// (CLAUDE.md §C rule 3). Matches TatvaTasks.vue's lead-resolve-safe pattern.
watch(() => props.lead, () => props.lead && stages.reload(), { immediate: true })

const options = computed(() => stages.data || [])
const current = computed(() => options.value.find((s) => s.name === props.modelValue))
const currentColor = computed(() => current.value?.color || 'gray')

// display_label is "Program / Main / Substage" — strip the redundant program prefix so a
// single-program pill reads "Main / Substage".
const clean = (s) => (s?.display_label || '').split(' / ').slice(1).join(' / ') || s?.stage || ''
const currentLabel = computed(() => clean(current.value) || props.mainStage || __('Set stage'))

// Flat, clickable list (leaves-only per the server resolver) — no grouping headers.
const dropdownOptions = computed(() =>
  options.value.map((s) => ({
    label: clean(s),
    icon: () => h(IndicatorIcon, { class: parseColor(s.color || 'gray') }),
    onClick: () => emit('change', s.name),
  })),
)
</script>
