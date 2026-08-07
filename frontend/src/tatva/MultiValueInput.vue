<!-- TATVA: the editor for a lead field that takes MORE THAN ONE value (CRM Lead API Field.is_multi_value).
     The model is a plain list of picklist ids — there is no child-row shape here, because the selections
     hang off the LEAD (tatva_connect.lead.multi_value) and not off a column. Options come from the
     server's own `link_query`, forwarded to the Link control's existing `query`/`filters` props: the
     client never derives a category, a grain or a doctype. -->
<template>
  <div
    class="group flex w-full flex-wrap gap-1 rounded bg-surface-gray-2 p-1.5 text-base transition-colors hover:bg-surface-gray-3"
  >
    <Button
      v-for="(id, i) in modelValue"
      :key="id"
      :label="labels[i] || id"
      theme="gray"
      variant="subtle"
      class="rounded bg-surface-white hover:!bg-surface-gray-1"
    >
      <template #suffix>
        <FeatherIcon class="h-3.5" name="x" @click.stop="remove(id)" />
      </template>
    </Button>
    <div class="w-full">
      <Link
        class="form-control flex-1 cursor-text truncate"
        :doctype="doctype"
        :query="query"
        :filters="filters"
        :value="''"
        :hideMe="true"
        @change="add"
      >
        <!-- Content yields, the control does not (H2): the row of tokens wraps, the picker keeps its line. -->
        <template #target="{ togglePopover }">
          <button class="h-7 w-full cursor-text" @click.stop="togglePopover" />
        </template>
      </Link>
    </div>
  </div>
</template>

<script setup>
import Link from '@/components/Controls/Link.vue'
import { Button, FeatherIcon } from 'frappe-ui'

const props = defineProps({
  // The ids currently selected, in the order they were picked.
  modelValue: { type: Array, default: () => [] },
  // The labels the SERVER resolved for those ids, positionally. Never resolved again here: the
  // composite `::` primary key must not reach a reader, and one resolver already answered it.
  labels: { type: Array, default: () => [] },
  doctype: { type: String, required: true },
  query: { type: String, default: null },
  filters: { type: [Array, Object, String], default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

// A selection is a SET: picking the same option twice means what picking it once meant.
function add(id) {
  if (!id || props.modelValue.includes(id)) return
  emit('update:modelValue', [...props.modelValue, id])
}

function remove(id) {
  emit(
    'update:modelValue',
    props.modelValue.filter((v) => v !== id),
  )
}
</script>
