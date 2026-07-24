<template>
  <FormControl
    v-if="filter.fieldtype == 'Check'"
    v-model="model"
    :label="filter.label"
    type="checkbox"
    @change.stop="updateFilter(filter, $event.target.checked)"
  />
  <FormControl
    v-else-if="filter.fieldtype === 'Select'"
    v-model="model"
    class="form-control cursor-pointer [&_select]:cursor-pointer"
    type="select"
    :options="filter.options"
    :placeholder="filter.label"
    @update:modelValue="updateFilter(filter, $event)"
  />
  <!-- TATVA: a grain axis is scoped to the values on visible leads, not the whole master (a plain Link leaks other business lines). -->
  <FormControl
    v-else-if="isGrainFilterField(doctype, filter.fieldname)"
    v-model="model"
    class="form-control cursor-pointer [&_select]:cursor-pointer"
    type="select"
    :options="grainOptions(filter.fieldname)"
    :placeholder="filter.label"
    @update:modelValue="updateFilter(filter, $event)"
  />
  <Link
    v-else-if="filter.fieldtype === 'Link'"
    :value="model"
    :doctype="filter.options"
    :placeholder="filter.label"
    @change="(data) => updateFilter(filter, data)"
  />
  <component
    :is="filter.fieldtype === 'Date' ? DatePicker : DateTimePicker"
    v-else-if="['Date', 'Datetime'].includes(filter.fieldtype)"
    class="border-none"
    :value="model"
    :placeholder="filter.label"
    @change="(v) => updateFilter(filter, v)"
  />
  <FormControl
    v-else
    v-model="model"
    type="text"
    :placeholder="filter.label"
    @focus="focused = true"
    @blur="focused = false"
    @input.stop="debouncedFn(filter, $event.target.value)"
  />
</template>
<script setup>
import Link from '@/components/Controls/Link.vue'
import {
  useGrainFilterOptions,
  isGrainFilterField,
} from '@/tatva/useGrainFilterOptions'
import { FormControl, DatePicker, DateTimePicker } from 'frappe-ui'
import { useDebounceFn } from '@vueuse/core'
import { ref, watch } from 'vue'

const props = defineProps({
  filter: { type: Object, required: true },
  // TATVA: needed to tell a grain axis from any other Link field — grain filtering is a CRM Lead concern.
  doctype: { type: String, default: '' },
  // The value currently applied in the list params; the model syncs FROM it, never the reverse while typing.
  appliedValue: { type: [String, Boolean], default: '' },
})

const emit = defineEmits(['applyQuickFilter'])

// TATVA: one shared, cached source for the scoped grain values (see useGrainFilterOptions).
const { optionsFor: grainOptions } = useGrainFilterOptions()

// Local edit state — authoritative while focused, so a mid-type reload (its applied value lags the keystrokes) can't clobber it.
const model = ref(props.appliedValue)
const focused = ref(false)
watch(
  () => props.appliedValue,
  (v) => {
    if (!focused.value) model.value = v
  },
)

const debouncedFn = useDebounceFn((f, value) => {
  emit('applyQuickFilter', f, value)
}, 500)

function updateFilter(f, value) {
  emit('applyQuickFilter', f, value)
}
</script>
