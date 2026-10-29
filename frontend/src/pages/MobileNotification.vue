<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs
        :items="[
          { label: __('Notifications'), route: { name: 'Notifications' } },
        ]"
      />
    </template>
    <template #right-header>
      <Button
        :tooltip="__('Mark all as read')"
        :label="__('Mark all as read')"
        :iconLeft="MarkAsDoneIcon"
        @click="() => mark_as_read.reload()"
      />
    </template>
  </LayoutHeader>
  <!-- TATVA: the desktop tray's own body (tatva/NotificationList.vue) — filters, day groups, Load more, empty states; the socket is listened to once, from App.vue. -->
  <NotificationList />
</template>
<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import MarkAsDoneIcon from '@/components/Icons/MarkAsDoneIcon.vue'
import NotificationList from '@/tatva/NotificationList.vue' // TATVA
import { notificationsStore } from '@/stores/notifications'
import { Breadcrumbs } from 'frappe-ui'

const { mark_as_read } = notificationsStore()
</script>
