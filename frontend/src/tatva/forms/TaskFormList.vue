<!-- TATVA: Task Forms list page — every CRM Task Type an author may build. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs :items="[{ label: __('Task Forms'), route: { name: 'TaskForms' } }]" />
    </template>
  </LayoutHeader>
  <div class="flex flex-1 flex-col">
    <EmptyState name="Task Forms" :icon="LucideClipboardList" />
  </div>
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import LucideClipboardList from '~icons/lucide/clipboard-list'
import { Breadcrumbs } from 'frappe-ui'
</script>
