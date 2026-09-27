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
        :options="bindingOptions"
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
import { scrub } from '@/tatva/scrub'
import { getRandom } from '@/utils'
import { ErrorMessage, FormControl } from 'frappe-ui'
import { computed, ref } from 'vue'

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

// A lead question takes the lead column's own type; one a question cannot take is asked as Data.
const storedType = (f) => (props.types.includes(f.fieldtype) ? f.fieldtype : 'Data')
const NEW = 'new'
const leadKey = (fieldname) => `lead:${fieldname}`
const columnKey = (section, target) => `column:${section}:${target}`

// New answer, then the lead's fields of this question's type, then every column home Desk's Target offers.
const bindingOptions = computed(() => [
  // Named, not blank: frappe-ui reads the list as grouped only when its first group has a name; the header stays hidden.
  { group: __('New'), hideLabel: true, items: [{ label: __('New answer'), value: NEW }] },
  {
    group: __('Lead'),
    items: props.leadFields
      .filter((f) => storedType(f) === row.value.fieldtype)
      .map((f) => ({ label: f.label, value: leadKey(f.fieldname) })),
  },
  ...props.bindings.activity.map((home) => ({
    group: home.title,
    items: home.columns.map((c) => ({ label: c.label, value: columnKey(home.section, c.fieldname) })),
  })),
])
const binding = computed(() => {
  if (fromLead.value) return leadKey(row.value.fieldname)
  if (row.value.target) return columnKey(row.value.section || '', row.value.target)
  return NEW
})

// A fresh key off the label, for a question that stops reading a lead field and answers under its own name.
const ownKey = () => `${scrub(row.value.label || row.value.fieldtype)}_${getRandom().toLowerCase()}`

// Each binding writes the row Desk writes: a lead field into the lead snapshot section under the lead's own key;
// a column into its section and target; a new answer into neither, stored under its own key.
function bind(option) {
  const value = option && typeof option === 'object' ? option.value : option
  const r = row.value
  if (!value || value === NEW) {
    if (r.source === 'Lead') r.fieldname = ownKey()
    Object.assign(r, { source: 'Activity', section: '', target: '' })
  } else if (value.startsWith('lead:')) {
    const f = props.leadFields.find((l) => l.fieldname === value.slice(5))
    Object.assign(r, {
      source: 'Lead',
      section: props.bindings.lead_section,
      target: '',
      fieldname: f.fieldname,
      label: f.label,
      fieldtype: storedType(f),
      options: '',
    })
  } else {
    const [, section, target] = value.split(':')
    if (r.source === 'Lead') r.fieldname = ownKey()
    Object.assign(r, { source: 'Activity', section, target })
  }
}

// A new question's key follows its label; a lead question's key IS the lead field, and a saved one is fixed.
const autoKey = ref(!saved.value && !fromLead.value)
function followLabel(label) {
  if (autoKey.value && !saved.value && !fromLead.value) row.value.fieldname = scrub(label)
}
</script>
