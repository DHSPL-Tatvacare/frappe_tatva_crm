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
      :options="options"
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
    <FormControl
      v-else
      :data-test="`value-input-${control}`"
      :type="control === 'data' ? 'text' : control"
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
import { groupedOptions } from '@/tatva/valueOptions'

const props = defineProps({
  // The ways this value may be filled, in the CONTRACT's own words — never spelled in this file.
  modes: { type: Array, default: () => [] },
  // {mode: control} from the same declaration, so a mode's input is never inferred from its position.
  modeControls: { type: Object, default: () => ({}) },
  // Already-grouped rows from the ONE grouper: the values this node may read.
  valueRows: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
// `{mode, value}` — the shape a Value Map row already stores, so nothing reshapes it on the way through.
const model = defineModel({ type: Object, default: () => ({ mode: '', value: '' }) })

const modeOptions = computed(() => props.modes.map((m) => ({ label: __(m), value: m })))
const control = computed(() => props.modeControls[model.value?.mode] || 'data')
// The saved value is passed through, so a reference no longer offered is shown rather than blanked.
const options = computed(() => groupedOptions(props.valueRows, model.value?.value))

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
