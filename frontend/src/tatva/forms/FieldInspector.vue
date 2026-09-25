<!-- TATVA: Task Forms question panel — one question's own settings, written straight onto its row; the server judges the save. -->
<template>
  <div class="flex flex-col gap-4">
    <FormControl
      v-model="row.label"
      :label="__('Label')"
      :disabled="!editable"
      @update:modelValue="followLabel"
    />
    <div class="flex flex-col gap-1">
      <FormControl
        v-model="row.fieldname"
        :label="__('Key')"
        :disabled="!editable || keyLocked"
        :description="keyLocked ? keyLockReason : ''"
        @update:modelValue="autoKey = false"
      />
      <ErrorMessage v-if="duplicate" :message="__('Another question already uses this key.')" />
    </div>
    <FormControl
      v-model="row.fieldtype"
      type="select"
      :label="__('Type')"
      :options="typeOptions"
      :disabled="!editable || fromLead"
    />
    <FormControl
      v-if="row.fieldtype === 'Select'"
      v-model="row.options"
      type="textarea"
      :label="__('Choices')"
      :description="__('One per line.')"
      :disabled="!editable"
    />
    <FormControl
      v-else-if="row.fieldtype === 'Link'"
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
    <p class="text-sm text-ink-gray-5">
      {{ fromLead ? __('Answered from the lead.') : __('Answered by the rep.') }}
    </p>
  </div>
</template>
<script setup>
import { questionTypeLabel } from './questionTypes'
import { scrub } from '@/tatva/scrub'
import { ErrorMessage, FormControl } from 'frappe-ui'
import { computed, ref } from 'vue'

// The question being edited, written in place — a model, as FieldLayoutEditor's tabs are.
const row = defineModel('row', { type: Object, required: true })
const props = defineProps({
  editable: { type: Boolean, default: false },
  types: { type: Array, required: true },
  duplicate: { type: Boolean, default: false },
})

const fromLead = computed(() => row.value.source === 'Lead')
// A saved key is what answers, Smart Views and Workflows address; a lead question's key IS the lead field.
const keyLocked = computed(() => Boolean(row.value.name) || fromLead.value)
const keyLockReason = computed(() =>
  fromLead.value ? __('The lead field this question reads.') : __('Locked once saved — answers are stored under it.'),
)
// The row's own type stays offered even when the picker's list no longer carries it.
const typeOptions = computed(() =>
  [...new Set([...props.types, row.value.fieldtype])].filter(Boolean).map((t) => ({ label: questionTypeLabel(t), value: t })),
)

// A new question's key follows its label until the author types a key of their own.
const autoKey = ref(!keyLocked.value)
function followLabel(label) {
  if (autoKey.value && !keyLocked.value) row.value.fieldname = scrub(label)
}
</script>
