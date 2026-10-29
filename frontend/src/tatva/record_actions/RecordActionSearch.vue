<!-- TATVA: one server-searched field of a record action's dialog, shaped like Controls/Link.vue: it reads only once opened, and again as the person types; Helpdesk has the same piece. -->
<template>
  <RecordActionChoice
    v-model="model"
    :field="field"
    :options="options"
    :filterable="false"
    :clearable="!field.reqd"
    @open="search(text)"
    @query="(query) => (text = query)"
  />
</template>

<script setup>
import { watchDebounced } from '@vueuse/core'
import { createResource } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import RecordActionChoice from '@/tatva/record_actions/RecordActionChoice.vue'
import { RECORD_ACTIONS_API } from '@/tatva/record_actions/recordActions'

const props = defineProps({
  field: { type: Object, required: true },
  action: { type: String, required: true },
  doctype: { type: String, required: true },
  name: { type: String, required: true },
  // The choices the form was built for, such as the project.
  values: { type: Object, required: true },
})
const model = defineModel({ type: String, default: null })

const text = ref('')
// The picked option, kept so the field still shows it when a later search does not return it.
const picked = ref(null)

const results = createResource({
  url: `${RECORD_ACTIONS_API}.search`,
  method: 'GET',
  makeParams: ({ query }) => ({
    action: props.action,
    doctype: props.doctype,
    name: props.name,
    field: props.field.fieldname,
    query,
    values: JSON.stringify(props.values),
  }),
})

// One search per query: the list on screen already answers the query it was read for.
function search(query) {
  if (results.fetched && results.params?.query === query) return
  results.fetch({ query })
}
// Typing searches again once the person pauses; the server keeps each answer for a while.
watchDebounced(text, (query) => results.fetched && search(query), { debounce: 300 })

watch(model, (value) => {
  picked.value = value ? (results.data || []).find((r) => r.value === value) || picked.value : null
})

const options = computed(() => {
  const rows = results.data || []
  return picked.value && !rows.some((r) => r.value === picked.value.value) ? [picked.value, ...rows] : rows
})
</script>
