<!-- TATVA: the Bulk Actions read state and action filter, the tray's Unread/All tabs and type menu over the same store. -->
<template>
  <div class="flex items-center justify-between gap-2 border-b px-5 py-2.5">
    <TabButtons v-model="readState" :buttons="readStateButtons" />
    <Dropdown v-if="typeCounts.length > 1" :options="typeOptions" placement="right">
      <Button variant="ghost" size="sm" :label="typeLabel" icon-right="chevron-down" />
    </Dropdown>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Button, Dropdown, TabButtons } from 'frappe-ui'
import { unreadOnly, typeFilter, typeCounts, actionLabel } from '@/stores/bulkActionsPanel'

const readStateButtons = [
  { label: __('Unread'), value: 'unread' },
  { label: __('All'), value: 'all' },
]

const readState = computed({
  get: () => (unreadOnly.value ? 'unread' : 'all'),
  set: (v) => (unreadOnly.value = v === 'unread'),
})

const typeOptions = computed(() => [
  { label: __('All types'), onClick: () => (typeFilter.value = null) },
  ...typeCounts.value.map((t) => ({
    label: `${actionLabel(t.type)} · ${t.count}`,
    onClick: () => (typeFilter.value = t.type),
  })),
])

const typeLabel = computed(() => {
  if (!typeFilter.value) return __('All types')
  const hit = typeCounts.value.find((t) => t.type === typeFilter.value)
  return `${actionLabel(typeFilter.value)} · ${hit ? hit.count : 0}`
})
</script>
