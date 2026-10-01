<!-- TATVA: Notifications, screen 1 — the master switch, then the two channels, each summarised by how many of its switches are on. -->
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

    <template v-else-if="settings.data">
      <NotificationToggleRow
        :label="master.label"
        :description="master.description"
        :model-value="master.enabled"
        @update:model-value="(val) => saveSetting(master, val)"
      />

      <ul class="flex flex-col px-2">
        <li v-for="(channel, i) in channels" :key="channel.key">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-surface-gray-1 active:bg-surface-gray-2"
            @click="updateStep(channel.key)"
          >
            <component
              :is="channel.icon"
              class="h-4 w-4 shrink-0 text-ink-gray-7"
            />
            <div class="flex min-w-0 flex-1 flex-col">
              <div class="text-p-base font-medium text-ink-gray-8">
                {{ channel.label }}
              </div>
              <div class="text-p-sm text-ink-gray-5">
                {{ channel.description }}
              </div>
            </div>
            <span class="shrink-0 text-p-sm text-ink-gray-5">
              {{ channel.summary }}
            </span>
            <FeatherIcon
              name="chevron-right"
              class="h-4 w-4 shrink-0 text-ink-gray-5"
            />
          </button>
          <div
            v-if="i !== channels.length - 1"
            class="mx-2 h-px border-t border-outline-gray-modals"
          />
        </li>
      </ul>
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

<script setup>
import { computed, inject } from 'vue'
import { Button, FeatherIcon } from 'frappe-ui'
import BellIcon from '~icons/lucide/bell'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'

const updateStep = inject('updateStep')
const settings = inject('settings')
const saveSetting = inject('saveSetting')

const master = computed(() => settings.data.master)

// "2 of 3 on" counts only what the user can turn on; with a master off nothing is sent, so the tally reads Off.
function tally(rows, open) {
  if (!open) return __('Off')
  const on = rows.filter((r) => r.enabled).length
  return on ? __('{0} of {1} on', [on, rows.length]) : __('Off')
}

const channels = computed(() => {
  const data = settings.data
  const available = data.push.rows.filter((r) => r.available)
  return [
    {
      key: 'push',
      label: __('Push notifications'),
      description: __('Alerts on your phone and desktop when you are away.'),
      icon: BellIcon,
      summary: available.length
        ? tally(available, master.value.enabled && data.push.master.enabled)
        : __('Not set up'),
    },
    {
      key: 'email',
      label: __('Email notifications'),
      description: __('Emails about assignments, mentions and shared leads.'),
      icon: EmailIcon,
      summary: tally(
        data.email.rows,
        master.value.enabled && data.email.master.enabled,
      ),
    },
  ]
})
</script>
