<!-- TATVA: Notifications — the master, one line per channel that opens its own screen, and the reminder lead times, over ONE read of the user's own Notification Settings row. -->
<template>
  <NotificationChannel
    v-if="data && step !== 'list'"
    :channel="step"
    :data="data"
    :save-setting="saveSetting"
    @back="step = 'list'"
  />
  <div v-else class="flex h-full flex-col gap-6 p-6 text-ink-gray-8">
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

    <div v-if="settings.loading && !settings.data" class="mt-16 flex w-full justify-center">
      <Button :loading="true" variant="ghost" size="2xl" />
    </div>

    <div v-else-if="data" class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <NotificationToggleRow
        :label="data.master.label"
        :description="data.master.description"
        :model-value="data.master.enabled"
        @update:model-value="(val) => saveSetting(data.master, val)"
      />

      <section class="flex flex-col">
        <div class="flex items-baseline justify-between gap-3 px-4 py-2 text-sm text-ink-gray-5">
          <span class="shrink-0">{{ __('Channels') }}</span>
          <span class="min-w-0 truncate text-p-sm">{{ __('Every notice always shows in your bell.') }}</span>
        </div>
        <div class="mx-4 h-px border-t border-outline-gray-modals" />
        <template v-for="(line, i) in channelLines" :key="line.channel">
          <div v-if="i" class="mx-4 h-px border-t border-outline-gray-modals" />
          <button
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            :class="line.opens ? 'cursor-pointer hover:bg-surface-gray-2' : 'cursor-default'"
            :disabled="!line.opens"
            @click="step = line.channel"
          >
            <span
              class="text-p-base font-medium"
              :class="line.opens ? 'text-ink-gray-8' : 'text-ink-gray-4'"
            >
              {{ line.label }}
            </span>
            <span class="flex min-w-0 items-center gap-2">
              <span class="truncate text-p-sm text-ink-gray-5">{{ line.summary }}</span>
              <FeatherIcon v-if="line.opens" name="chevron-right" class="size-4 shrink-0 text-ink-gray-5" />
            </span>
          </button>
        </template>
      </section>

      <section class="flex flex-col">
        <div class="px-4 py-2 text-sm text-ink-gray-5">
          {{ __('Reminders') }}
        </div>
        <div class="mx-4 h-px border-t border-outline-gray-modals" />
        <!-- One row per lead time the server sends; an older backend without moving_lead skips that row. -->
        <div
          v-for="(reminder, i) in reminders"
          :key="reminder.row.fieldname"
          class="flex items-center justify-between gap-3 px-4 py-3"
          :class="i ? 'border-t border-outline-gray-modals' : ''"
        >
          <div class="flex min-w-0 flex-col">
            <div class="text-p-base font-medium" :class="masterOn ? 'text-ink-gray-8' : 'text-ink-gray-4'">
              {{ reminder.label }}
            </div>
            <div class="text-p-sm" :class="masterOn ? 'text-ink-gray-5' : 'text-ink-gray-4'">
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
import { Button, createResource, FeatherIcon, FormControl, toast } from 'frappe-ui'
import BellIcon from '~icons/lucide/bell'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import NotificationChannel from '@/tatva/notifications/NotificationChannel.vue'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'
import { notificationSettingsResource } from '@/tatva/notifications/notificationSettings'
import { pushDevice } from '@/tatva/push'

const settings = notificationSettingsResource()
const data = computed(() => settings.data)
// Which screen shows: the list, or one channel ('email' | 'push'), as the native Settings screens drill down.
const step = ref('list')

const masterOn = computed(() => !!data.value?.master.enabled)
const offHint = __('Turn on System notifications to use this')

// One line per channel: its state in a few words, and whether it opens.
const channelLines = computed(() => [
  { channel: 'email', label: data.value.email.label, opens: masterOn.value, summary: emailSummary() },
  {
    channel: 'push',
    label: data.value.push.label,
    opens: masterOn.value && data.value.push.available,
    summary: pushSummary(),
  },
])

function emailSummary() {
  if (!masterOn.value) return offHint
  if (!data.value.email.enabled) return __('Off')
  const ticked = data.value.grid.filter((row) => row.available && row.email?.enabled).length
  return __('On · {0} notices', [ticked])
}

function pushSummary() {
  if (!data.value.push.available) return __('Not switched on for your team')
  if (!masterOn.value) return offHint
  if (!data.value.push.enabled) return __('Off')
  return pushDevice.state === 'on' ? __('On · this device') : __('On · not on this device')
}

// The lead times the server sends, each named after the notice it times.
const reminders = computed(() =>
  [
    { row: data.value?.lead, label: __('Task due soon'), hint: __('How early you hear before a task falls due.') },
    {
      row: data.value?.moving_lead,
      label: __('Lead moving soon'),
      hint: __('How early you hear before an unworked lead moves to another rep.'),
    },
  ].filter((r) => r.row),
)

const saver = createResource({
  url: 'tatva_connect.notifications.api.save_my_notification_settings',
})

// Every control on every screen lands here: only the one changed goes back, and only the newest answer is applied, so a quick second change never snaps back.
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
</script>
