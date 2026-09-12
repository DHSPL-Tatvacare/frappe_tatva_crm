<!--
  TATVA: PredicateJoiner — the ATOM. One group's joiner, and nothing else.

  It renders the word, it does not decide what the word means: the labels come from the host through
  `options`, because "All of" reads right over conditions and "Match all" reads right over a form rule,
  and a component this small has no business choosing between them.
-->
<template>
  <FormControl
    type="select"
    class="w-28 shrink-0"
    :modelValue="modelValue"
    :options="options"
    :disabled="disabled"
    @update:modelValue="(v) => emit('update:modelValue', v)"
  />
</template>

<script setup>
import { FormControl } from 'frappe-ui'

defineOptions({ name: 'PredicateJoiner' })

defineProps({
  modelValue: { type: String, default: 'and' },
  // [{ label, value }] — the host's words for and/or/not.
  options: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
</script>
