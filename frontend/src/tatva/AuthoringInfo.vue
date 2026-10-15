<!-- TATVA: an authored record's facts behind one ⓘ — the lead hover card's RecordCard in a click Popover; Workflows and Task Forms hand it their rows. -->
<template>
  <Popover placement="bottom-end">
    <template #target="{ togglePopover }">
      <Button variant="ghost" icon="info" :tooltip="__('Details')" @click="togglePopover()" />
    </template>
    <template #body>
      <RecordCard :title="title" :subtitle="subtitle" :rows="rows" />
    </template>
  </Popover>
</template>

<script setup>
import RecordCard from '@/tatva/RecordCard.vue'
import { Button, Popover } from 'frappe-ui'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  // [{ label, value }] in reading order, as RecordCard takes them.
  rows: { type: Array, default: () => [] },
})
</script>
