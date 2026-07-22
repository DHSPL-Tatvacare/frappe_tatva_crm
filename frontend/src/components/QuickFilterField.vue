<template>
  <FormControl
    v-if="filter.fieldtype == 'Check'"
    v-model="filter.value"
    :label="filter.label"
    type="checkbox"
    @change.stop="updateFilter(filter, $event.target.checked)"
  />
  <FormControl
    v-else-if="filter.fieldtype === 'Select'"
    v-model="filter.value"
    class="form-control cursor-pointer [&_select]:cursor-pointer"
    type="select"
    :options="filter.options"
    :placeholder="filter.label"
    @update:modelValue="updateFilter(filter, $event)"
  />
  <!-- TATVA: a grain axis is filtered by the values on the leads the user can SEE, not by the whole
       master. The Link control below searches the master with no field context, so our narrow User
       Permission never fires and it leaks every other business line's names. -->
  <FormControl
    v-else-if="isGrainFilterField(doctype, filter.fieldname)"
    v-model="filter.value"
    class="form-control cursor-pointer [&_select]:cursor-pointer"
    type="select"
    :options="grainOptions(filter.fieldname)"
    :placeholder="filter.label"
    @update:modelValue="updateFilter(filter, $event)"
  />
  <Link
    v-else-if="filter.fieldtype === 'Link'"
    :value="filter.value"
    :doctype="filter.options"
    :placeholder="filter.label"
    @change="(data) => updateFilter(filter, data)"
  />
  <component
    :is="filter.fieldtype === 'Date' ? DatePicker : DateTimePicker"
    v-else-if="['Date', 'Datetime'].includes(filter.fieldtype)"
    class="border-none"
    :value="filter.value"
    :placeholder="filter.label"
    @change="(v) => updateFilter(filter, v)"
  />
  <FormControl
    v-else
    v-model="filter.value"
    type="text"
    :placeholder="filter.label"
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
import { reactive, watch } from 'vue'

const props = defineProps({
  filter: { type: Object, required: true },
  // TATVA: needed to tell a grain axis from any other Link field — grain filtering is a CRM Lead concern.
  doctype: { type: String, default: '' },
})

// TATVA: one shared, cached source for the scoped grain values (see useGrainFilterOptions).
const { optionsFor: grainOptions } = useGrainFilterOptions()

const filter = reactive(props.filter)

const emit = defineEmits(['applyQuickFilter'])

watch(
  () => props.filter,
  (newFilter) => Object.assign(filter, newFilter),
  { deep: true },
)

const debouncedFn = useDebounceFn((f, value) => {
  emit('applyQuickFilter', f, value)
}, 500)

function updateFilter(f, value) {
  emit('applyQuickFilter', f, value)
}
</script>
