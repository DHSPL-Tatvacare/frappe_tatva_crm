<!--
  TatvaStagePill — the lead header lifecycle button, grain-scoped.

  Replaces the native status <Dropdown> on the lead surface (pages/Lead.vue + pages/MobileLead.vue).
  Options come from ONE server resolver (tatva_connect.lead.leads.lead_stages) scoped to the lead's
  program; picking emits the chosen leaf sub-stage name, which the parent writes to custom_substage via
  triggerOnChange. The server validate (validate_stage) is the single fail-closed backstop and derives
  the read-only parent custom_stage. modelValue = the rep's pick (custom_substage); the button shows
  the option's display_label (the doctype title_field) — the `::` PK never reaches the UI. Pure
  presentation + one resource call — NO business logic.

  Uses frappe-ui Autocomplete: searchable + built-in max-h-[15rem] scroll so a ~60-stage list never
  runs page-long; #target hosts the colored-dot pill trigger, #item-prefix draws the per-option dot.
  Server order (position asc, stage asc) is preserved as-is — we filter, never re-sort.

  Lives in frontend/src/tatva/ (additive — never conflicts on upstream cherry-pick).
-->
<template>
  <Autocomplete
    v-if="options.length"
    :options="autocompleteOptions"
    :modelValue="modelValue"
    :maxOptions="autocompleteOptions.length"
    placement="bottom-start"
    @change="onPick"
  >
    <template #target="{ togglePopover, isOpen }">
      <!-- TATVA: `hideLabel` mirrors Filter.vue / SortBy.vue — icon-only on a narrow header, where a stage name like "Chemo Completed - Post Health Check" wrapped and clipped the row. -->
      <!-- The DOT is the icon, not a generic glyph: its colour IS the stage, so the one signal worth keeping survives. The label stays the real string and becomes the aria-label + tooltip. -->
      <Button
        :label="currentLabel"
        :iconRight="hideLabel ? undefined : isOpen ? 'chevron-up' : 'chevron-down'"
        :tooltip="hideLabel ? currentLabel : ''"
        @click="togglePopover"
      >
        <template v-if="hideLabel" #icon>
          <IndicatorIcon :class="parseColor(currentColor)" />
        </template>
        <template v-else #prefix>
          <IndicatorIcon :class="parseColor(currentColor)" />
        </template>
      </Button>
    </template>
    <template #item-prefix="{ option }">
      <IndicatorIcon :class="parseColor(option.color || 'gray')" />
    </template>
  </Autocomplete>
</template>

<script setup>
import { computed } from 'vue'
import { Autocomplete, Button, createResource } from 'frappe-ui'
import IndicatorIcon from '@/components/Icons/IndicatorIcon.vue'
import { parseColor } from '@/utils'

const props = defineProps({
  lead: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  hideLabel: { type: Boolean, default: false }, // TATVA: icon-only trigger for a narrow header; defaults to today's behaviour
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

// {label,value} per Autocomplete; value = the `::` PK (stored, never rendered). Server order kept —
// maxOptions = full length so a long list is never truncated (default 50 would cut ~60 stages).
const autocompleteOptions = computed(() =>
  options.value.map((s) => ({ label: clean(s), value: s.name, color: s.color || 'gray' })),
)

// Autocomplete emits the whole option; a null (deselect click) is ignored so we never blank the stage.
const onPick = (option) => option?.value && emit('change', option.value)
</script>
