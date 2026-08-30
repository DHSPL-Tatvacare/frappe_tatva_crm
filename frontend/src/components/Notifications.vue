<!-- eslint-disable vue/no-v-html -->
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
      <!-- Read state is the primary choice and carries the segmented control; type is a refinement and sits behind one ghost trigger, so the two do not compete — and six chips cannot wrap across a 350px panel. -->
      <div class="flex items-center justify-between gap-2 border-b px-5 py-2.5">
        <TabButtons v-model="readState" :buttons="readStateButtons" />
        <Dropdown
          v-if="typeCounts.length > 1"
          :options="typeOptions"
          placement="right"
        >
          <Button
            variant="ghost"
            size="sm"
            :label="typeLabel"
            icon-right="chevron-down"
          />
        </Dropdown>
      </div>
      <div
        v-if="groupedNotifications.length"
        class="divide-y divide-outline-gray-modals overflow-auto text-base"
      >
        <div v-for="group in groupedNotifications" :key="group.key">
          <div
            class="sticky top-0 z-10 bg-surface-gray-1 px-5 py-1 text-sm text-ink-gray-5"
          >
            {{ group.label }}
          </div>
          <RouterLink
            v-for="n in group.items"
            :key="rowKey(n)"
            :to="getRoute(n)"
            class="flex cursor-pointer items-start gap-2.5 px-4 py-2.5 hover:bg-surface-gray-2"
            @click="markAsRead(n.comment || n.notification_type_doc)"
          >
            <div class="mt-1 flex items-center gap-2.5">
              <div
                class="size-[5px] rounded-full"
                :class="[n.read ? 'bg-transparent' : 'bg-surface-gray-7']"
              />
              <WhatsAppIcon v-if="n.type == 'WhatsApp'" class="size-7" />
              <UserAvatar v-else :user="n.from_user.name" size="lg" />
            </div>
            <div>
              <div
                v-if="n.notification_text"
                v-html="sanitizeHTML(n.notification_text)"
              />
              <div v-else class="mb-2 space-x-1 leading-5 text-ink-gray-5">
                <span class="font-medium text-ink-gray-9">
                  {{ n.from_user.full_name }}
                </span>
                <span>
                  {{ __('mentioned you in {0}', [n.reference_doctype]) }}
                </span>
                <span class="font-medium text-ink-gray-9">
                  {{ n.reference_name }}
                </span>
              </div>
              <div class="text-sm text-ink-gray-5">
                {{ __(timeAgo(n.creation)) }}
              </div>
            </div>
          </RouterLink>
        </div>
        <!-- The page grows on demand; the filters above narrow what is already fetched, so more rows can only come from here. -->
        <div v-if="hasMore" class="p-3">
          <Button
            class="w-full"
            :label="__('Load more')"
            :loading="notifications.loading"
            @click="loadMore"
          />
        </div>
      </div>
      <!-- TATVA: three emptinesses, three sentences — "No new notifications" was shown for all of them and was wrong for two. -->
      <EmptyState
        v-else
        name="Notifications"
        :title="emptyState.title"
        :description="emptyState.description"
        :icon="NotificationsIcon"
        width="lg"
      />
    </div>
  </div>
</template>
<script setup>
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import MarkAsDoneIcon from '@/components/Icons/MarkAsDoneIcon.vue'
import NotificationsIcon from '@/components/Icons/NotificationsIcon.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import {
  visible,
  notifications,
  notificationsStore,
  unreadOnly,
  typeFilter,
  typeCounts,
  groupedNotifications,
  unreadNotificationsCount,
  hasMore,
  loadMore,
  setServerUnread,
} from '@/stores/notifications'
import { globalStore } from '@/stores/global'
import { timeAgo, sanitizeHTML } from '@/utils'
import { onClickOutside, useDebounceFn } from '@vueuse/core'
import { Badge, Dropdown, TabButtons } from 'frappe-ui'
import { useTelemetry } from 'frappe-ui/frappe'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const { $socket } = globalStore()
const { mark_as_read, toggle, mark_doc_as_read } = notificationsStore()
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

const readStateButtons = [
  { label: __('Unread'), value: 'unread' },
  { label: __('All'), value: 'all' },
]

// TabButtons speaks a value and the store holds the boolean; one computed bridges them so the tab state has no second copy.
const readState = computed({
  get: () => (unreadOnly.value ? 'unread' : 'all'),
  set: (v) => (unreadOnly.value = v === 'unread'),
})

const typeOptions = computed(() => [
  { label: __('All types'), onClick: () => (typeFilter.value = null) },
  ...typeCounts.value.map((t) => ({
    label: `${__(t.type)} · ${t.count}`,
    onClick: () => (typeFilter.value = t.type),
  })),
])

const typeLabel = computed(() => {
  if (!typeFilter.value) return __('All types')
  const hit = typeCounts.value.find((t) => t.type === typeFilter.value)
  return `${__(typeFilter.value)} · ${hit ? hit.count : 0}`
})

// `comment` is null on every non-Mention row, so keying on it collided every Assignment, Task and WhatsApp row onto one key.
function rowKey(n) {
  return n.name || `${n.type}:${n.creation}:${n.notification_type_doc}`
}

const emptyState = computed(() => {
  if (typeFilter.value)
    return {
      title: __('Nothing here'),
      description: __('No {0} notifications in this view.', [
        __(typeFilter.value),
      ]),
    }
  if (unreadOnly.value)
    return {
      title: __("You're all caught up"),
      description: __(
        'No unread notifications. Switch to All to see earlier ones.',
      ),
    }
  return {
    title: __('No notifications'),
    description: __('You have no notifications yet.'),
  }
})

function markAsRead(doc) {
  capture('notification_mark_as_read')
  mark_doc_as_read(doc)
}

function markAllAsRead() {
  capture('notification_mark_all_as_read')
  mark_as_read.reload()
}

// TATVA: one event per notification and a bulk assignment sends hundreds — the count rides the payload, and the list refetches at most twice a second and only while the tray is open.
const reloadSoon = useDebounceFn(() => notifications.reload(), 500)

function onNotification(event) {
  if (event && Number.isFinite(event.unread)) setServerUnread(event.unread)
  if (visible.value) reloadSoon()
}

onBeforeUnmount(() => {
  $socket.off('crm_notification', onNotification)
})

onMounted(() => {
  $socket.on('crm_notification', onNotification)
})

function getRoute(notification) {
  let params = {
    leadId: notification.reference_name,
  }
  if (notification.route_name === 'Deal') {
    params = {
      dealId: notification.reference_name,
    }
  }
  return {
    name: notification.route_name,
    params: params,
    hash: notification.hash,
  }
}
</script>
