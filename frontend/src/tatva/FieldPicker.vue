<!-- TATVA: THE control for "pick a field, or a value produced by one" — the workflow canvas's field
     dropdowns, wherever they appear.

     It exists because five screens each mounted an Autocomplete of their own and dressed it differently.
     frappe-ui's draws `option.description` as a right-hand column that cannot shrink and caps nothing, so
     one 58-character reference set the width of the whole list and pushed the canvas off screen — fixed on
     two screens and not on the other three, which is how the Route condition and the Email recipient came
     to look like different products. Mounting THIS instead of an Autocomplete is what makes a fix land
     once: the row shape, the width cap and the page size are decided here and nowhere else.

     It is a thin pass-through, never a fork: the app's own Autocomplete does the work (it is the one that
     exposes `item-label`), every attribute a caller sets travels on, and the model is the option the
     caller already speaks. -->
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
