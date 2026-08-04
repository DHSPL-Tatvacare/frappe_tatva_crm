<!-- TATVA: the `Field Map` renderer — one row per field this node sets, and how that field is filled.
     Value Map's twin, and NOT Value Map: there the rows are a template's blanks, enumerated for the author
     and fixed; here the author names them, so rows are added and removed. `ValueMap.vue` rebuilds its model
     from the fetched slot list on every edit, which would delete an authored row on the next keystroke.
     Rows STACK rather than sit side by side: this panel is 288px, and three controls across it leave none
     of them usable. -->
<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(row, i) in rows"
      :key="i"
      class="flex flex-col gap-1.5 rounded-md border border-outline-gray-2 bg-surface-gray-1 p-2"
      data-test="field-map-row"
    >
      <div class="flex items-center gap-1.5">
        <Autocomplete
          class="min-w-0 flex-1"
          :modelValue="row.name"
          :options="fieldOptions(row.name)"
          :placeholder="__('Choose a field to set')"
          :disabled="disabled"
          @update:modelValue="(v) => update(i, { name: v?.value ?? '' })"
        />
        <!-- Always visible: `opacity-0 group-hover` would make this unreachable on a phone. -->
        <Button variant="ghost" icon="x" :label="__('Remove')" :disabled="disabled" @click="removeAt(i)" />
      </div>

      <FormControl
        type="select"
        :options="modeOptions"
        :modelValue="row.mode"
        :disabled="disabled"
        @update:modelValue="(v) => setMode(i, v)"
      />

      <!-- WHICH control this mode's value is entered with is the DECLARATION's answer (`mode_controls`),
           never this file's. Deciding it here would be deciding what a mode means, in the one place that
           cannot be locked by a Python test. -->
      <Autocomplete
        v-if="controlFor(row.mode) === 'value-picker'"
        :data-test="`field-map-value-${controlFor(row.mode)}`"
        :modelValue="row.value"
        :options="valueOptionsFor(row.value)"
        :placeholder="__('Choose a value')"
        :disabled="disabled"
        @update:modelValue="(v) => update(i, { value: v?.value ?? '' })"
      />
      <FormControl
        v-else
        :data-test="`field-map-value-${controlFor(row.mode)}`"
        :type="controlFor(row.mode) === 'data' ? 'text' : controlFor(row.mode)"
        :rows="controlFor(row.mode) === 'textarea' ? 2 : undefined"
        :placeholder="placeholderFor(row.mode)"
        :modelValue="row.value"
        :disabled="disabled"
        @update:modelValue="(v) => update(i, { value: v })"
      />
    </div>

    <p v-if="!rows.length" class="text-p-sm text-ink-gray-5">
      {{ __('No fields set yet. This node runs and changes nothing.') }}
    </p>

    <Button
      variant="subtle"
      icon-left="plus"
      :label="__('Set a field')"
      :disabled="disabled"
      @click="add"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Button, FormControl, Autocomplete } from 'frappe-ui'
import { groupedOptions } from '@/tatva/valueOptions'

const props = defineProps({
  // The two ways a row is filled, in the CONTRACT's own words — never spelled in this file.
  modes: { type: Array, default: () => [] },
  // {mode: control} from the same declaration, so a mode's input is not inferred from its position.
  modeControls: { type: Object, default: () => ({}) },
  // Already-grouped rows from the ONE grouper: the fields this node may WRITE, and the values it may READ.
  fieldRows: { type: Array, default: () => [] },
  valueRows: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
const model = defineModel({ type: Array, default: () => [] })

const rows = computed(() => model.value || [])
const modeOptions = computed(() => props.modes.map((m) => ({ label: __(m), value: m })))

function controlFor(mode) {
  return props.modeControls[mode] || 'data'
}

// The saved value is passed through, so a field or reference no longer offered is shown rather than blanked.
function fieldOptions(selected) {
  return groupedOptions(props.fieldRows, selected)
}
function valueOptionsFor(selected) {
  return groupedOptions(props.valueRows, selected)
}

function placeholderFor(mode) {
  const control = controlFor(mode)
  if (control === 'number') return __('How much to add')
  if (control === 'textarea') return __('ctx["crm_lead.status"]')
  return __('Type the value to write')
}

// Written whole each time, or the inspector's JSON and this control disagree about the same rows.
function write(next) {
  model.value = next
}

function update(i, patch) {
  write(rows.value.map((row, n) => (n === i ? { ...row, ...patch } : row)))
}

// Switching mode REPLACES the value: a reference left behind would be written as text, and a typed value
// left behind would be read as a reference to something that does not exist.
function setMode(i, mode) {
  update(i, { mode, value: '' })
}

// A new row starts in the first declared mode — the same shape a saved row has, so nothing special-cases it.
function add() {
  write([...rows.value, { name: '', mode: props.modes[0] || '', value: '' }])
}

function removeAt(i) {
  write(rows.value.filter((_, n) => n !== i))
}
</script>
