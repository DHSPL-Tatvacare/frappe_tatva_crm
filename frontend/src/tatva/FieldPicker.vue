<!-- TATVA: THE picker for a field or a value produced by one, on every workflow screen: one row shape and page size here; the list width comes from the screen's `pickerLayout`. A thin pass-through over the app's Autocomplete. -->
<template>
  <Autocomplete
    v-bind="$attrs"
    :modelValue="modelValue"
    :options="options"
    :multiple="multiple"
    :placeholder="placeholder"
    :disabled="disabled"
    :maxOptions="maxOptions"
    @update:modelValue="(v) => emit('update:modelValue', v)"
  >
    <template #item-label="{ option }">
      <OptionRow :option="option" />
    </template>
  </Autocomplete>
</template>

<script setup>
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import OptionRow from '@/tatva/OptionRow.vue'

defineOptions({ name: 'FieldPicker', inheritAttrs: false })

defineProps({
  modelValue: { type: [String, Number, Object, Array, null], default: null },
  options: { type: Array, default: () => [] },
  multiple: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  // The ceiling the server's own search already answers at, so a browsing author sees every row it sent.
  maxOptions: { type: Number, default: 50 },
})

const emit = defineEmits(['update:modelValue'])
</script>
