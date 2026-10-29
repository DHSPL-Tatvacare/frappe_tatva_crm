<!-- TATVA: one choice field of a record action's dialog on the CRM's own Autocomplete: each option's picture and short code, one value or several; it says when it opens and what is typed, for a caller that searches. -->
<template>
  <div class="space-y-1.5">
    <label class="block text-xs text-ink-gray-5">
      {{ field.label }}<span v-if="field.reqd" class="text-ink-red-3"> *</span>
    </label>
    <Autocomplete
      ref="picker"
      :value="modelValue"
      :options="options"
      :multiple="multiple"
      :filterable="filterable"
      :placeholder="field.placeholder || __('Select')"
      @change="pick"
    >
      <template v-if="chosen?.image" #prefix>
        <Avatar class="mr-2" size="xs" :image="chosen.image" :label="chosen.label" :shape="chosen.round ? 'circle' : 'square'" />
      </template>
      <!-- Declared only with pictures: this slot replaces the picker's own tick, which a many-valued field keeps. -->
      <template v-if="pictured" #item-prefix="{ option }">
        <Avatar class="mr-2" size="xs" :image="option.image" :label="option.label" :shape="option.round ? 'circle' : 'square'" />
      </template>
      <template #item-label="{ option }">
        <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span class="truncate text-ink-gray-7">{{ option.label }}</span>
          <span v-if="option.hint" class="shrink-0 text-sm text-ink-gray-5">{{ option.hint }}</span>
        </div>
      </template>
      <template v-if="clearable" #footer="{ close }">
        <Button variant="ghost" class="w-full !justify-start" :label="__('Clear')" iconLeft="x" @click="clear(close)" />
      </template>
    </Autocomplete>
  </div>
</template>

<script setup>
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { Avatar, Button } from 'frappe-ui'
import { computed, ref, watch } from 'vue'

const props = defineProps({
  field: { type: Object, required: true },
  options: { type: Array, default: () => [] },
  modelValue: { type: [String, Array], default: null },
  multiple: { type: Boolean, default: false },
  // Off for a list the server already matched to the query.
  filterable: { type: Boolean, default: true },
  // A Clear row under the list, for an optional searched field.
  clearable: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'open', 'query'])

const picker = ref(null)
const pictured = computed(() => props.options.some((o) => o.image))
const chosen = computed(() => (props.multiple ? null : props.options.find((o) => o.value === props.modelValue)))

// The picker hands back options; the dialog holds plain values.
const keyOf = (v) => (v && typeof v === 'object' ? v.value : v)
function pick(value) {
  emit('update:modelValue', props.multiple ? (value || []).map(keyOf) : keyOf(value) ?? null)
}
function clear(close) {
  emit('update:modelValue', null)
  close()
}

watch(() => picker.value?.isOpen, (open) => open && emit('open'))
watch(() => picker.value?.query, (query) => emit('query', query || ''))
</script>
