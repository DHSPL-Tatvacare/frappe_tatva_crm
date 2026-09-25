<!-- TATVA: one Task Form — the builder for a single CRM Task Type. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs
        :items="[
          { label: __('Task Forms'), route: { name: 'Task Forms' } },
          { label: formName },
        ]"
      />
    </template>
  </LayoutHeader>
  <div class="flex flex-1 flex-col">
    <EmptyState
      name="Task Form"
      :icon="LucideClipboardList"
      :title="formName"
      :description="__('The builder opens here.')"
    />
  </div>
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import LucideClipboardList from '~icons/lucide/clipboard-list'
import { Breadcrumbs } from 'frappe-ui'

defineProps({ formName: { type: String, required: true } })
</script>
