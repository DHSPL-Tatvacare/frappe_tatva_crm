<!-- TATVA: ONE value and how it is filled — the mode switch plus the editor that mode DECLARES (`mode_controls`), extracted because FieldMap's rows, ValueMap's rows and a Wait's instant all asked the same question. -->
<template>
  <div class="flex flex-col gap-1.5">
    <FormControl
      type="select"
      :options="modeOptions"
      :modelValue="model.mode"
      :disabled="disabled"
      @update:modelValue="setMode"
    />

    <Autocomplete
      v-if="control === 'value-picker'"
      :data-test="`value-input-${control}`"
      :modelValue="model.value"
      :options="referenceOptions"
      :placeholder="__('Choose a value')"
      :disabled="disabled"
      @update:modelValue="(v) => setValue(v?.value ?? '')"
    />
    <DateTimePicker
      v-else-if="control === 'datetime'"
      :data-test="`value-input-${control}`"
      :value="model.value"
      :placeholder="__('Pick a date and time')"
      :disabled="disabled"
      @change="setValue"
    />
    <!-- The app's own Link control, so a grain-keyed row shows its TITLE and never `Field-Sales::…`. -->
    <Link
      v-else-if="control === 'link'"
      :data-test="`value-input-${control}`"
      :doctype="doctype"
      :value="model.value"
      :placeholder="__('Choose one')"
      :disabled="disabled"
      @change="setValue"
    />
    <FormControl
      v-else
      :data-test="`value-input-${control}`"
      :type="control === 'data' ? 'text' : control"
      :options="control === 'select' ? literal.options : undefined"
      :rows="control === 'textarea' ? 2 : undefined"
      :placeholder="placeholder"
      :modelValue="model.value"
      :disabled="disabled"
      @update:modelValue="setValue"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FormControl, Autocomplete, DateTimePicker } from 'frappe-ui'
import Link from '@/components/Controls/Link.vue'
import { groupedOptions, controlFor } from '@/tatva/valueOptions'

const props = defineProps({
  // The ways this value may be filled, in the CONTRACT's own words — never spelled in this file.
  modes: { type: Array, default: () => [] },
  // {mode: control} from the same declaration, so a mode's input is never inferred from its position.
  modeControls: { type: Object, default: () => ({}) },
  // Already-grouped rows from the ONE grouper: the values this node may read.
  valueRows: { type: Array, default: () => [] },
  // The FIELD this value is for: a mode says HOW it is filled, only the field says WHAT it is.
  field: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
})
// `{mode, value}` — the shape a Value Map row already stores, so nothing reshapes it on the way through.
const model = defineModel({ type: Object, default: () => ({ mode: '', value: '' }) })

const modeOptions = computed(() => props.modes.map((m) => ({ label: __(m), value: m })))
// `mode_controls` still decides; only the literal defers to the field, whose own value it is.
const declared = computed(() => props.modeControls[model.value?.mode] || 'data')
const literal = computed(() => controlFor(props.field))
const control = computed(() => (declared.value === 'data' ? literal.value.control : declared.value))
const doctype = computed(() => literal.value.doctype || '')
// The saved value is passed through, so a reference no longer offered is shown rather than blanked.
const referenceOptions = computed(() => groupedOptions(props.valueRows, model.value?.value))

const PLACEHOLDERS = {
  number: 'How much to add',
  textarea: 'ctx["crm_lead.status"]',
  data: 'Type the value',
}
const placeholder = computed(() => __(PLACEHOLDERS[control.value] || PLACEHOLDERS.data))

function setValue(value) {
  model.value = { ...model.value, value: value ?? '' }
}

// Switching mode REPLACES the value: a reference left behind is written as text, a typed value left behind is read as a reference to nothing.
function setMode(mode) {
  model.value = { ...model.value, mode, value: '' }
}
</script>
