<!-- TATVA: Notifications — the master, one line per channel and for quiet hours that opens its own screen, and the reminder lead times, over ONE read of the user's own Notification Settings row. -->
<template>
  <QuietHours v-if="data && step === 'quiet'" :data="data" :save="saveValues" @back="step = 'list'" />
  <NotificationChannel
    v-else-if="data && step !== 'list'"
    :channel="step"
    :data="data"
    :save-setting="saveSetting"
    @back="step = 'list'"
  />
  <SettingsLayoutBase
    v-else
    :title="__('Notifications')"
    :description="__('Choose how the CRM reaches you about your leads and tasks.')"
  >
    <template #content>
      <div class="flex flex-col gap-6">
        <div v-if="settings.loading && !settings.data" class="mt-16 flex w-full justify-center">
          <Button :loading="true" variant="ghost" size="2xl" />
        </div>

        <template v-else-if="data">
          <NotificationToggleRow
            :label="data.master.label"
            :description="data.master.description"
            :model-value="data.master.enabled"
            @update:model-value="(val) => saveSetting(data.master, val)"
          />

          <section v-for="group in drillGroups" :key="group.title" class="flex flex-col">
            <div class="py-2 text-sm text-ink-gray-5">{{ group.title }}</div>
            <div class="h-px border-t border-outline-gray-modals" />
            <template v-for="(line, i) in group.lines" :key="line.step">
              <div v-if="i" class="h-px border-t border-outline-gray-modals" />
              <button
                class="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 text-left"
                :class="line.opens ? 'cursor-pointer hover:bg-surface-gray-2' : 'cursor-default'"
                :disabled="!line.opens"
                @click="step = line.step"
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
            <div class="py-2 text-sm text-ink-gray-5">
              {{ __('Reminders') }}
            </div>
            <div class="h-px border-t border-outline-gray-modals" />
            <!-- One row per lead time the server sends; an older backend without moving_lead skips that row. -->
            <div
              v-for="(reminder, i) in reminders"
              :key="reminder.row.fieldname"
              class="flex items-center justify-between gap-3 py-3"
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
        </template>

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
  </SettingsLayoutBase>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, createResource, FeatherIcon, FormControl, toast } from 'frappe-ui'
import BellIcon from '~icons/lucide/bell'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import NotificationChannel from '@/tatva/notifications/NotificationChannel.vue'
import SettingsLayoutBase from '@/components/Layouts/SettingsLayoutBase.vue'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'
import QuietHours from '@/tatva/notifications/QuietHours.vue'
import { useSheetDrill } from '@/tatva/settingsSheet'
import { notificationSettingsResource, QUIET_WEEK } from '@/tatva/notifications/notificationSettings'
import { pushDevice } from '@/tatva/push'

const settings = notificationSettingsResource()
const data = computed(() => settings.data)
// Which screen shows: the list, one channel ('email' | 'push'), or quiet hours ('quiet'), as the native Settings screens drill down.
const step = ref('list')

// In the mobile Settings sheet the sheet's own header names a drilled screen and its one back returns here.
useSheetDrill(
  computed(() => (step.value === 'list' || !data.value ? '' : step.value === 'quiet' ? __('Quiet hours') : data.value[step.value].label)),
  () => (step.value = 'list'),
)

const masterOn = computed(() => !!data.value?.master.enabled)
const offHint = __('Turn on System notifications to use this')

// One line per screen it opens: its state in a few words, and whether it opens; an older backend without quiet hours skips that group.
const drillGroups = computed(() =>
  [
    {
      title: __('Channels'),
      lines: [
        { step: 'email', label: data.value.email.label, opens: masterOn.value, summary: emailSummary() },
        {
          step: 'push',
          label: data.value.push.label,
          opens: masterOn.value && data.value.push.available,
          summary: pushSummary(),
        },
      ],
    },
    data.value.quiet && {
      title: __('Quiet hours'),
      lines: [
        {
          step: 'quiet',
          label: __('Quiet hours'),
          opens: masterOn.value && data.value.quiet.available,
          summary: quietSummary(),
        },
      ],
    },
  ].filter(Boolean),
)

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

function quietSummary() {
  const quiet = data.value.quiet
  if (!quiet.available) return __('Not switched on for your team')
  if (!masterOn.value) return offHint
  if (!quiet.on) return __('Off')
  return `${quiet.from} – ${quiet.to} · ${daysSummary(quiet.days)}`
}

function daysSummary(days) {
  if (days.length === 7) return __('Every day')
  if (days.join() === QUIET_WEEK.slice(0, 5).map((d) => d.value).join()) return __('Mon–Fri')
  return days.map((d) => __(d).slice(0, 3)).join(', ')
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
    {
      row: data.value?.waiting_lead,
      label: __('Work waiting'),
      hint: __('How long work waits with nobody here to take it before you hear. Managers only.'),
    },
  ].filter((r) => r.row),
)

const saver = createResource({
  url: 'tatva_connect.notifications.api.save_my_notification_settings',
})

// Every control on every screen lands here: only what changed goes back, and only the newest answer is applied, so a quick second change never snaps back.
let latest = 0
function saveValues(values, undo = () => {}) {
  const ticket = ++latest
  saver.submit(
    { values },
    {
      onSuccess: (stored) => ticket === latest && settings.setData(stored),
      onError: () => {
        if (ticket !== latest) return
        undo()
        toast.error(__('Could not save. Try again.'))
      },
    },
  )
}

function saveSetting(row, val, key = 'enabled') {
  const before = row[key]
  row[key] = val // optimistic
  saveValues({ [row.fieldname]: val }, () => (row[key] = before))
}
</script>
