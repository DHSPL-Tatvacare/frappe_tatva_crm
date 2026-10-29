<template>
  <div
    v-if="visible"
    ref="target"
    class="absolute z-20 h-[100dvh] bg-surface-white transition-all duration-300 ease-in-out"
    :style="{
      'box-shadow': '8px 0px 8px rgba(0, 0, 0, 0.1)',
      'max-width': '350px',
      'min-width': '350px',
      left: 'calc(100% + 1px)',
    }"
  >
    <div class="flex h-[100dvh] flex-col text-ink-gray-9">
      <div
        class="z-20 flex items-center justify-between border-b bg-surface-white px-5 py-2.5"
      >
        <div class="flex items-center gap-2">
          <div class="text-base font-medium">{{ __('Notifications') }}</div>
          <Badge
            v-if="unreadNotificationsCount"
            :label="String(unreadNotificationsCount)"
            theme="blue"
            variant="subtle"
          />
        </div>
        <div class="flex gap-1">
          <!-- TATVA: one action, two names — on the Unread tab clearing the unread IS emptying the panel. -->
          <Button
            v-if="unreadNotificationsCount"
            :tooltip="unreadOnly ? __('Clear all') : __('Mark all as read')"
            :icon="MarkAsDoneIcon"
            variant="ghost"
            @click="markAllAsRead"
          />
          <Button
            :tooltip="__('Close')"
            icon="x"
            variant="ghost"
            @click="() => toggle()"
          />
        </div>
      </div>
      <!-- TATVA: the tray body is shared with the mobile page (tatva/NotificationList.vue). -->
      <NotificationList />
    </div>
  </div>
</template>
<script setup>
import MarkAsDoneIcon from '@/components/Icons/MarkAsDoneIcon.vue'
import NotificationList from '@/tatva/NotificationList.vue' // TATVA
import {
  visible,
  notificationsStore,
  unreadOnly,
  unreadNotificationsCount,
} from '@/stores/notifications'
import { onClickOutside } from '@vueuse/core'
import { Badge } from 'frappe-ui'
import { useTelemetry } from 'frappe-ui/frappe'
import { ref } from 'vue'

const { mark_as_read, toggle } = notificationsStore()
const { capture } = useTelemetry()

const target = ref(null)
onClickOutside(
  target,
  () => {
    if (visible.value) toggle()
  },
  {
    // The type menu is PORTALLED out of this panel (Reka renders it at the body), so without naming its wrapper a click on a menu item reads as a click outside and closes the whole tray.
    ignore: ['#notifications-btn', '[data-reka-popper-content-wrapper]'],
  },
)

function markAllAsRead() {
  capture('notification_mark_all_as_read')
  mark_as_read.reload()
}
</script>
