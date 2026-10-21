<!-- TATVA: Notifications — one screen over ONE read of the user's own Notification Settings row: the masters, a notice × channel grid, and the task-reminder lead time. -->
<template>
  <div class="flex h-full flex-col gap-6 p-6 text-ink-gray-8">
    <div class="flex justify-between px-2 pt-2">
      <div class="flex w-9/12 flex-col gap-1">
        <h2 class="flex h-5 gap-2 text-xl font-semibold leading-none">
          {{ __('Notifications') }}
        </h2>
        <p class="text-p-base text-ink-gray-6">
          {{ __('Choose how the CRM reaches you about your leads and tasks.') }}
        </p>
      </div>
    </div>

    <div
      v-if="settings.loading && !settings.data"
      class="mt-16 flex w-full justify-center"
    >
      <Button :loading="true" variant="ghost" size="2xl" />
    </div>

    <div
      v-else-if="data"
      class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto"
    >
      <NotificationToggleRow
        :label="data.master.label"
        :description="data.master.description"
        :model-value="data.master.enabled"
        @update:model-value="(val) => saveSetting(data.master, val)"
      />

      <section class="flex flex-col">
        <div class="px-4 py-2 text-sm text-ink-gray-5">
          {{ __('Channels') }}
        </div>
        <div class="mx-4 h-px border-t border-outline-gray-modals" />
        <template v-for="(channel, i) in channels" :key="channel.fieldname">
          <div v-if="i" class="mx-4 h-px border-t border-outline-gray-modals" />
          <NotificationToggleRow
            :label="channel.label"
            :description="masterOn ? channel.description : offHint"
            :model-value="channel.enabled"
            :disabled="!masterOn"
            :muted="!masterOn"
            @update:model-value="(val) => saveSetting(channel, val)"
          />
        </template>
        <template v-if="data.push.available">
          <div class="mx-4 h-px border-t border-outline-gray-modals" />
          <NotificationToggleRow
            :label="__('Alerts on this device')"
            :description="
              __(
                'Show push alerts in this browser, even when the app is closed.',
              )
            "
            :model-value="deviceOn"
            @update:model-value="toggleDevice"
          />
        </template>
      </section>

      <section class="flex flex-col">
        <div class="mx-4 flex items-center gap-3 py-2 text-sm text-ink-gray-5">
          <span class="min-w-0 flex-1">{{ __('Notify me about') }}</span>
          <span class="w-14 shrink-0 text-center">{{ __('Email') }}</span>
          <span v-if="data.push.available" class="w-14 shrink-0 text-center">
            {{ __('Push') }}
          </span>
        </div>
        <ul
          class="mx-4 divide-y divide-outline-gray-modals border-t border-outline-gray-modals"
        >
          <li
            v-for="row in data.grid"
            :key="row.type"
            class="flex items-center gap-3 py-3"
          >
            <div class="flex min-w-0 flex-1 flex-col">
              <div
                class="truncate text-p-base font-medium"
                :class="isMuted(row) ? 'text-ink-gray-4' : 'text-ink-gray-8'"
              >
                {{ row.label }}
              </div>
              <div
                class="hidden truncate text-p-sm sm:block"
                :class="isMuted(row) ? 'text-ink-gray-4' : 'text-ink-gray-5'"
              >
                {{
                  row.available
                    ? row.description
                    : __('Not switched on for your team yet')
                }}
              </div>
            </div>
            <div class="flex w-14 shrink-0 justify-center">
              <Checkbox
                :model-value="row.email.enabled"
                :disabled="!emailOn || !row.available"
                @update:model-value="(val) => saveSetting(row.email, val)"
              />
            </div>
            <div
              v-if="data.push.available"
              class="flex w-14 shrink-0 justify-center"
            >
              <Checkbox
                v-if="row.push"
                :model-value="row.push.enabled"
                :disabled="!pushOn || !row.available"
                @update:model-value="(val) => saveSetting(row.push, val)"
              />
              <span v-else class="text-p-sm text-ink-gray-4">—</span>
            </div>
          </li>
        </ul>
        <p
          class="mx-4 border-t border-outline-gray-modals pt-3 text-p-sm text-ink-gray-5"
        >
          {{ __('Every notice also shows in your bell.') }}
        </p>
      </section>

      <section class="flex flex-col">
        <div class="px-4 py-2 text-sm text-ink-gray-5">
          {{ __('Reminders') }}
        </div>
        <div class="mx-4 h-px border-t border-outline-gray-modals" />
        <!-- One row per reminder lead time; an older backend sends no moving_lead and that row is skipped. -->
        <div
          v-for="(reminder, i) in reminders"
          :key="reminder.row.fieldname"
          class="flex items-center justify-between gap-3 px-4 py-3"
          :class="i ? 'border-t border-outline-gray-modals' : ''"
        >
          <div class="flex min-w-0 flex-col">
            <div
              class="text-p-base font-medium"
              :class="masterOn ? 'text-ink-gray-8' : 'text-ink-gray-4'"
            >
              {{ reminder.label }}
            </div>
            <div
              class="text-p-sm"
              :class="masterOn ? 'text-ink-gray-5' : 'text-ink-gray-4'"
            >
              {{ masterOn ? reminder.hint : offHint }}
            </div>
          </div>
          <FormControl
            type="select"
            size="sm"
            class="w-32 shrink-0"
            :options="reminder.row.options"
            :model-value="reminder.row.value"
            :disabled="!masterOn"
            @update:model-value="(val) => saveSetting(reminder.row, val, 'value')"
          />
        </div>
      </section>
    </div>

    <div v-else class="flex flex-1 flex-col">
      <EmptyState
        name="Notifications"
        :title="__('Could not load your notification settings')"
        :description="__('Close and reopen this panel to try again.')"
        :icon="BellIcon"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, Checkbox, createResource, FormControl, toast } from 'frappe-ui'
import BellIcon from '~icons/lucide/bell'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'
import { notificationSettingsResource } from '@/tatva/notifications/notificationSettings'
import { initTatvaPush } from '@/tatva/push'

const settings = notificationSettingsResource()
const data = computed(() => settings.data)

const masterOn = computed(() => !!data.value?.master.enabled)
const emailOn = computed(() => masterOn.value && data.value.email.enabled)
const pushOn = computed(() => masterOn.value && data.value.push.enabled)
const offHint = __('Turn on System notifications to use this')
// The reminder lead times the server sends, one row each; a field an older backend leaves out is skipped.
const reminders = computed(() =>
  [
    {
      row: data.value?.lead,
      label: __('Remind me before a task is due'),
      hint: __('When the Task due soon notice reaches you.'),
    },
    {
      row: data.value?.moving_lead,
      label: __('Warn me before an unworked lead moves'),
      hint: __('When the Lead moving soon notice reaches you.'),
    },
  ].filter((r) => r.row),
)

const channels = computed(() =>
  data.value.push.available
    ? [data.value.email, data.value.push]
    : [data.value.email],
)

// A row reads as off when its notice is not switched on for the team, or when no channel it can reach is on.
function isMuted(row) {
  return !row.available || !(emailOn.value || (row.push && pushOn.value))
}

const saver = createResource({
  url: 'tatva_connect.notifications.api.save_my_notification_settings',
})

// Every control lands here: only the one changed goes back, and only the newest answer is applied, so a quick second change never snaps back.
let latest = 0
function saveSetting(row, val, key = 'enabled') {
  const before = row[key]
  const ticket = ++latest
  row[key] = val // optimistic
  saver.submit(
    { values: { [row.fieldname]: val } },
    {
      onSuccess: (stored) => ticket === latest && settings.setData(stored),
      onError: () => {
        if (ticket !== latest) return
        row[key] = before
        toast.error(__('Could not save. Try again.'))
      },
    },
  )
}

// The browser's own permission, not a stored field: granting drives the FCM registration, revoking is the browser's alone.
const deviceOn = ref(
  typeof Notification !== 'undefined' && Notification.permission === 'granted',
)

async function toggleDevice(val) {
  if (!val) {
    toast.info(
      __('Turn off notifications for this site in your browser settings.'),
    )
    return
  }
  await initTatvaPush()
  deviceOn.value =
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  if (!deviceOn.value) {
    toast.error(
      __('Enable notifications for this site in your browser settings.'),
    )
  }
}
</script>
