<!-- TATVA: a many-valued field of a record action's dialog: the server's options, plus the typed value as a new one when the field allows it; Helpdesk has the same piece. -->
<template>
  <RecordActionChoice
    v-model="model"
    :field="field"
    :options="options"
    multiple
    @query="(query) => (text = query)"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import RecordActionChoice from '@/tatva/record_actions/RecordActionChoice.vue'

const props = defineProps({ field: { type: Object, required: true } })
const model = defineModel({ type: Array, default: () => [] })

const text = ref('')

// The server's options, the values already chosen, and the typed value as a new one.
const options = computed(() => {
  const known = props.field.options || []
  const values = new Set(known.map((o) => o.value))
  const chosen = model.value.filter((v) => !values.has(v)).map((v) => ({ label: v, value: v }))
  const typed = text.value.trim()
  const fresh =
    props.field.allow_new && typed && !values.has(typed) && !model.value.includes(typed)
      ? [{ label: __('Add "{0}"', [typed]), value: typed }]
      : []
  return [...fresh, ...chosen, ...known]
})
</script>
