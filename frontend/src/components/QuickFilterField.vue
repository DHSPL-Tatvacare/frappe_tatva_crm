<template>
  <!-- TATVA: ONE control decision, made in `tatva/fieldControl`. This file used to hold its own
       if-this-then-that chain — a second copy of the one in Filter.vue — which is why a grain axis was a
       plain dropdown here and a scoped dropdown there, and why neither could ever offer "is one of".
       The bar pins its operator (`=`, or `in` once several values are picked); the control follows. -->
  <component
    :is="control.is"
    v-if="control.is"
    v-bind="control.props"
    :class="control.is === Autocomplete ? '' : 'form-control'"
    :modelValue="boundValue"
    :placeholder="filter.label"
    @update:modelValue="onChange"
    @change="onChange"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
// The same control `fieldControl` resolves to, so the comparison below matches what is actually mounted.
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { resolveControl, valuesOf } from '@/tatva/fieldControl'

const props = defineProps({
  filter: { type: Object, required: true },
  // The value currently applied in the list params; the model syncs FROM it, never the reverse while typing.
  appliedValue: { type: [String, Boolean, Number, Array], default: '' },
})
const emit = defineEmits(['applyQuickFilter'])

// The bar shows no operator, but it HAS one. A field whose values come from a LIST is always "is one of",
// so you can pick more than one from the first click — deciding it from whether a list already exists was
// a circle that never opened: the control could not be multi until a list existed, and no list could be
// built without a multi control. One value in an "is one of" is the same query as equals, so nothing is
// lost by starting there. Everything else stays equals.
// A column holding several values is asked whether it CONTAINS one, so it takes exactly one at a time —
// the server says which columns those are, and this reads that rather than any fieldname.
const operator = computed(() => {
  if (props.filter?.match === 'contains') return '='
  return valuesOf(props.filter).kind === 'free' ? '=' : 'in'
})
const control = computed(() => resolveControl(props.filter, operator.value))

// A multi control's empty state is an empty LIST, not an empty string.
const emptyValue = computed(() => (control.value.arity === 'many' ? [] : ''))

// Local edit state — authoritative while focused, so a mid-type reload (its applied value lags the
// keystrokes) cannot clobber it.
const model = ref(props.appliedValue || emptyValue.value)
const focused = ref(false)
watch(
  () => props.appliedValue,
  (v) => {
    if (!focused.value) model.value = v === '' || v == null ? emptyValue.value : v
  },
  { immediate: true },
)

// frappe-ui's Autocomplete models an OPTION ({label, value}), not a bare value — a list of them when
// multiple. Its own contract (Autocomplete/types.ts), read rather than assumed. Everything else models
// the value itself, so the value is dressed as an option only for the control that asks for one.
const boundValue = computed(() => {
  if (control.value.is !== Autocomplete) return model.value
  const opts = control.value.props?.options || []
  const asOption = (v) => opts.find((o) => o.value === v) || { label: String(v), value: v }
  if (control.value.arity === 'many') {
    return (Array.isArray(model.value) ? model.value : []).map(asOption)
  }
  return model.value === '' || model.value == null ? null : asOption(model.value)
})

const debounced = useDebounceFn((value) => emit('applyQuickFilter', props.filter, value), 500)

function onChange(value) {
  // A multi picker emits the chosen options; a single picker emits one option; a text box emits an event.
  // Reduce all three to the value the filter actually carries.
  const one = (o) => (o && typeof o === 'object' && 'value' in o ? o.value : o)
  const v = Array.isArray(value)
    ? value.map(one)
    : value?.target
      ? value.target.value
      : one(value)
  model.value = v
  // Only free typing needs debouncing; a pick is deliberate and applies at once.
  if (control.value.props?.type === 'text') debounced(v)
  else emit('applyQuickFilter', props.filter, v)
}
</script>
