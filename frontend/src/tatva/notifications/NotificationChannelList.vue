<!-- TATVA: Notifications, screen 1 — the two channels, each summarised by how many of its switches are on.
     Both resources are already in flight from the parent, so this renders its counts with no call. -->
<template>
  <div class="flex h-full flex-col gap-6 p-6 text-ink-gray-8">
    <div class="flex justify-between px-2 pt-2">
      <div class="flex w-9/12 flex-col gap-1">
        <h2 class="flex h-5 gap-2 text-xl font-semibold leading-none">
          {{ __('Notifications') }}
        </h2>
        <p class="text-p-base text-ink-gray-6">
          {{
            __(
              'Choose how you want to be reached. In-app always works; these control your devices and your inbox.',
            )
          }}
        </p>
      </div>
    </div>

    <ul class="flex flex-col px-2">
      <li v-for="(channel, i) in channels" :key="channel.key">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-surface-gray-1 active:bg-surface-gray-2"
          @click="updateStep(channel.key)"
        >
          <component :is="channel.icon" class="h-4 w-4 shrink-0 text-ink-gray-7" />
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
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { FeatherIcon } from 'frappe-ui'
import BellIcon from '~icons/lucide/bell'
import EmailIcon from '@/components/Icons/EmailIcon.vue'

const updateStep = inject('updateStep')
const pushPrefs = inject('pushPrefs')
const emailPrefs = inject('emailPrefs')

// A rep can only turn on what the operator enabled, so the denominator is what is AVAILABLE, not the
// whole catalog — "2 of 3 on" beside 9 greyed rows would read as broken.
const pushSummary = computed(() => {
  if (pushPrefs.loading && !pushPrefs.data) return ''
  const rows = pushPrefs.data || []
  const available = rows.filter((r) => r.available)
  if (!available.length) return __('Not set up')
  const on = available.filter((r) => r.enabled).length
  return on ? __('{0} of {1} on', [on, available.length]) : __('Off')
})

// Email has no operator gate, so every row counts — but the master switch overrides the tally: with it
// off nothing is sent however many types are ticked underneath, and saying "3 on" there would be a lie.
const emailSummary = computed(() => {
  if (emailPrefs.loading && !emailPrefs.data) return ''
  const data = emailPrefs.data
  if (!data) return ''
  if (!data.master?.enabled) return __('Off')
  const rows = data.rows || []
  const on = rows.filter((r) => r.enabled).length
  return on ? __('{0} of {1} on', [on, rows.length]) : __('Off')
})

const channels = computed(() => [
  {
    key: 'push',
    label: __('Push notifications'),
    description: __('Alerts on your phone and desktop when you are away.'),
    icon: BellIcon,
    summary: pushSummary.value,
  },
  {
    key: 'email',
    label: __('Email notifications'),
    description: __('The same alerts delivered to your inbox.'),
    icon: EmailIcon,
    summary: emailSummary.value,
  },
])
</script>
