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

      <ValueInput
        :modelValue="{ mode: row.mode, value: row.value }"
        :modes="modes"
        :modeControls="modeControls"
        :valueRows="valueRows"
        :disabled="disabled"
        @update:modelValue="(v) => update(i, v)"
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
import { Button, Autocomplete } from 'frappe-ui'
import ValueInput from '@/tatva/ValueInput.vue'
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

// The saved value is passed through, so a field no longer offered is shown rather than blanked.
function fieldOptions(selected) {
  return groupedOptions(props.fieldRows, selected)
}

// Written whole each time, or the inspector's JSON and this control disagree about the same rows.
function write(next) {
  model.value = next
}

function update(i, patch) {
  write(rows.value.map((row, n) => (n === i ? { ...row, ...patch } : row)))
}

// A new row starts in the first declared mode — the same shape a saved row has, so nothing special-cases it.
function add() {
  write([...rows.value, { name: '', mode: props.modes[0] || '', value: '' }])
}

function removeAt(i) {
  write(rows.value.filter((_, n) => n !== i))
}
</script>
