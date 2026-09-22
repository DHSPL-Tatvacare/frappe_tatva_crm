<!-- TATVA: one record's "a queued delete owns me" state, drawn where that record already states its
     status. Renders nothing until `bulk_actions` says a Bulk Delete covers this row. -->
<template>
  <div v-if="deleting" :class="inline ? '' : 'border-b px-4 py-3 sm:px-6'">
    <Badge variant="subtle" theme="red" :label="__('Deletion in progress')" />
  </div>
</template>

<script setup>
import { Badge } from 'frappe-ui'
import { computed } from 'vue'
import { isDeleting } from '@/stores/bulkActionsPanel'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
  inline: { type: Boolean, default: false },
})

const deleting = computed(() => isDeleting(props.doctype, props.docname))
</script>
