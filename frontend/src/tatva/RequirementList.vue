<!-- TATVA: the Requirements control — the guard verbs a workflow demands BEFORE a save is allowed. -->
<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(entry, i) in model"
      :key="i"
      class="flex flex-wrap items-center gap-2"
    >
      <FormControl
        type="select"
        class="w-44"
        :modelValue="entry.verb"
        :options="verbOptions"
        :disabled="disabled"
        @update:modelValue="(v) => setVerb(i, v)"
      />
      <Autocomplete
        v-if="entry.verb === FIELD_VERB"
        class="w-44 flex-1"
        :modelValue="null"
        :options="fieldOptions"
        :placeholder="__('Add a field')"
        :disabled="disabled"
        @update:modelValue="(v) => addField(i, v?.value)"
      />
      <div v-else class="w-44 flex-1" />
      <Button
        variant="ghost"
        icon="x"
        :label="''"
        :disabled="disabled"
        @click="removeAt(i)"
      />

      <div
        v-if="entry.verb === FIELD_VERB && requiredFields(entry).length"
        class="flex w-full flex-wrap gap-1.5 pl-1"
      >
        <Button
          v-for="key in requiredFields(entry)"
          :key="key"
          variant="subtle"
          theme="gray"
          icon-right="x"
          :label="labelFor(key)"
          :disabled="disabled"
          @click="removeField(i, key)"
        />
      </div>
    </div>

    <div>
      <Button
        variant="ghost"
        iconLeft="plus"
        :label="__('Add requirement')"
        class="!text-ink-gray-6"
        :disabled="disabled || !verbs.length"
        @click="add"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { FormControl, Button, Autocomplete } from 'frappe-ui'

const props = defineProps({
  // Guard verbs the backend registry offers for this field.
  verbs: { type: Array, default: () => [] },
  // The subject's field catalog, from `automation.describe.builder_schema`.
  fields: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
const model = defineModel({ type: Array, default: () => [] })

// The one verb that carries parameters today.
const FIELD_VERB = 'Require Fields'

const verbOptions = computed(() => props.verbs.map((v) => ({ label: __(v), value: v })))
const fieldOptions = computed(() =>
  props.fields.map((f) => ({ label: f.label || f.key, value: f.key })),
)

function labelFor(key) {
  return props.fields.find((f) => f.key === key)?.label || key
}

// Stored as the comma-separated string the handler reads; edited here as a list.
function requiredFields(entry) {
  return String(entry?.params?.require_fields || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
}

function write(next) {
  model.value = next
}

function add() {
  write([...model.value, { verb: props.verbs[0], params: {} }])
}

function removeAt(i) {
  write(model.value.filter((_, j) => j !== i))
}

function setVerb(i, verb) {
  const next = [...model.value]
  next[i] = { verb, params: {} }
  write(next)
}

function setFields(i, keys) {
  const next = [...model.value]
  next[i] = { ...next[i], params: { ...next[i].params, require_fields: keys.join(',') } }
  write(next)
}

function addField(i, key) {
  if (!key) return
  const keys = requiredFields(model.value[i])
  if (keys.includes(key)) return
  setFields(i, [...keys, key])
}

function removeField(i, key) {
  setFields(
    i,
    requiredFields(model.value[i]).filter((k) => k !== key),
  )
}
</script>
