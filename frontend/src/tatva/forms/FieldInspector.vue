<!-- TATVA: Task Forms question panel — one question's own settings, written straight onto its row; the server judges the save. -->
<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <FormControl
        v-model="row.label"
        :label="__('Label')"
        :disabled="!editable"
        @update:modelValue="followLabel"
      />
      <ErrorMessage v-if="duplicate" :message="__('Another question already uses this name.')" />
    </div>
    <FormControl
      v-model="row.fieldtype"
      type="select"
      :label="__('Type')"
      :options="typeOptions"
      :disabled="!editable || fromLead"
    />
    <!-- Where the answer comes from and lands, as Desk's Source, Section and Target write it; fixed once saved, as answers are stored there. -->
    <div class="flex flex-col gap-1.5">
      <span class="block text-xs text-ink-gray-5">{{ __('Bound to') }}</span>
      <Autocomplete
        :options="choices"
        :modelValue="binding"
        :disabled="!editable || saved"
        @update:modelValue="bind"
      />
      <span class="text-p-xs text-ink-gray-5">
        {{ saved ? __('Fixed once saved: answers are stored there.') : __('A new answer, a lead field of this type, or an activity field.') }}
      </span>
    </div>
    <FormControl
      v-if="row.fieldtype === 'Select' && !fromLead"
      v-model="row.options"
      type="textarea"
      :label="__('Choices')"
      :description="__('One per line.')"
      :disabled="!editable"
    />
    <FormControl
      v-else-if="row.fieldtype === 'Link' && !fromLead"
      v-model="row.options"
      :label="__('Looks up')"
      :description="__('The record type to pick from, e.g. User.')"
      :disabled="!editable"
    />
    <FormControl
      v-model="row.reqd"
      type="checkbox"
      :label="__('Always required')"
      :disabled="!editable"
    />
    <FormControl
      v-model="row.read_only"
      type="checkbox"
      :label="__('Read only')"
      :disabled="!editable"
    />
  </div>
</template>
<script setup>
import Autocomplete from '@/components/frappe-ui/Autocomplete.vue'
import { bindRow, keyTail, newKey, questionType } from './formVocabulary'
import { ErrorMessage, FormControl } from 'frappe-ui'
import { computed } from 'vue'

// The question being edited, written in place — a model, as FieldLayoutEditor's tabs are.
const row = defineModel('row', { type: Object, required: true })
const props = defineProps({
  editable: { type: Boolean, default: false },
  types: { type: Array, required: true },
  // `builder_doc`'s lead fields and binding homes — the lists Desk's Fieldname and Target offer.
  leadFields: { type: Array, required: true },
  bindings: { type: Object, required: true },
  duplicate: { type: Boolean, default: false },
})

const fromLead = computed(() => row.value.source === 'Lead')
const saved = computed(() => Boolean(row.value.name))
// The row's own type stays offered even when the picker's list no longer carries it.
const typeOptions = computed(() =>
  [...new Set([...props.types, row.value.fieldtype])].filter(Boolean).map((t) => ({ label: __(t), value: t })),
)

// Every binding this question may take, by the key its option carries: a new answer, the lead's fields of its type
// (only while a section is declared to hold them — never a lead value in the general answers), then every column home.
const choices = computed(() => {
  const leadSection = props.bindings.lead_section
  const groups = [{ group: __('New'), hideLabel: true, items: [{ label: __('New answer'), value: 'new', to: {} }] }]
  if (leadSection) {
    groups.push({
      group: __('Lead'),
      items: props.leadFields
        .filter((f) => questionType(props.types, f) === row.value.fieldtype)
        .map((f) => ({ label: f.label, value: `lead:${f.fieldname}`, to: { lead: f, leadSection } })),
    })
  }
  for (const home of props.bindings.activity) {
    groups.push({
      group: home.title,
      // Only the columns that can hold this question's answer; the server says which (`takes`).
      items: home.columns.filter((c) => c.takes.includes(row.value.fieldtype)).map((c) => ({
        label: c.label,
        value: `column:${home.section}:${c.fieldname}`,
        to: { section: home.section, target: c.fieldname },
      })),
    })
  }
  return groups
})
const binding = computed(() => {
  if (fromLead.value) return `lead:${row.value.fieldname}`
  if (row.value.target) return `column:${row.value.section || ''}:${row.value.target}`
  return 'new'
})
function bind(option) {
  const value = option && typeof option === 'object' ? option.value : option
  const picked = choices.value.flatMap((g) => g.items).find((i) => i.value === value)
  if (picked) bindRow(row.value, picked.to, props.types)
}

// A new question's key follows its label, keeping its tail; a lead question's key IS the lead field, and a saved one is fixed.
function followLabel(label) {
  if (!saved.value && !fromLead.value) row.value.fieldname = newKey(label, keyTail(row.value.fieldname))
}
</script>
