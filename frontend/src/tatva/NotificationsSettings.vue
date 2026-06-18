<!-- TATVA: native Notifications prefs panel — mirrors the CRM's own settings screens
     (EmailTemplates / AssignmentRules): inline header, list rows with a right-aligned
     Switch, real EmptyState. Rows derive entirely from the server catalog
     (get_my_notification_prefs returns ONLY globally-enabled grains), so a rep never sees a
     dead toggle. The master "push on this device" switch drives initTatvaPush()/permission.
     frappe-ui components + design tokens only — no hex, light/dark clean. -->
<template>
  <div class="flex h-full flex-col gap-6 p-6 text-ink-gray-8">
    <!-- Header -->
    <div class="flex justify-between px-2 pt-2">
      <div class="flex flex-col gap-1 w-9/12">
        <h2 class="flex gap-2 text-xl font-semibold leading-none h-5">
          {{ __('Notifications') }}
        </h2>
        <p class="text-p-base text-ink-gray-6">
          {{
            __(
              'Choose what you get notified about. Delivered in-app while you are here, or pushed to your devices when you are away.',
            )
          }}
        </p>
      </div>
    </div>

    <!-- This device -->
    <div class="flex flex-col">
      <div class="flex items-center py-2 px-4 text-sm text-ink-gray-5">
        {{ __('This device') }}
      </div>
      <div class="h-px border-t mx-4 border-outline-gray-modals" />
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="flex flex-col pr-5">
          <div class="text-p-base font-medium text-ink-gray-8">
            {{ __('Push notifications on this device') }}
          </div>
          <div class="text-p-sm text-ink-gray-5">
            {{
              __(
                'Allow this browser to receive notifications when you are away from the app.',
              )
            }}
          </div>
        </div>
        <Switch
          size="sm"
          :model-value="pushOn"
          @update:model-value="togglePush"
        />
      </div>
    </div>

    <!-- Notify me about -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <div class="flex items-center py-2 px-4 text-sm text-ink-gray-5">
        {{ __('Notify me about') }}
      </div>
      <div class="h-px border-t mx-4 border-outline-gray-modals" />

      <!-- loading -->
      <div v-if="prefs.loading" class="flex mt-16 justify-center w-full">
        <Button :loading="true" variant="ghost" size="2xl" />
      </div>

      <!-- empty -->
      <EmptyState
        v-else-if="!rows.length"
        name="Notifications"
        :title="__('Nothing to subscribe to yet')"
        :description="
          __('Your admin has not turned on any notifications for the team.')
        "
        :icon="NotificationsIcon"
        top="20%"
      />

      <!-- list -->
      <ul v-else class="overflow-y-auto px-2">
        <template v-for="(row, i) in rows" :key="row.grain_key">
          <li class="flex items-center justify-between gap-3 px-2 py-3">
            <div class="flex flex-col pr-5">
              <div class="text-p-base font-medium text-ink-gray-8">
                {{ row.label }}
              </div>
              <div class="text-p-sm text-ink-gray-5">
                {{ row.description }}
              </div>
            </div>
            <Switch
              size="sm"
              :model-value="row.enabled"
              @update:model-value="(val) => toggleGrain(row, val)"
            />
          </li>
          <div
            v-if="rows.length !== i + 1"
            class="h-px border-t mx-2 border-outline-gray-modals"
          />
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup>
import NotificationsIcon from '@/components/Icons/NotificationsIcon.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import { initTatvaPush } from '@/tatva/push'
import { Switch, Button, createResource, toast } from 'frappe-ui'
import { ref, computed } from 'vue'

// Stored opt-ins, one row per globally-enabled grain.
const prefs = createResource({
  url: 'tatva_connect.notifications.api.get_my_notification_prefs',
  auto: true,
})
const rows = computed(() => prefs.data || [])

const saver = createResource({
  url: 'tatva_connect.notifications.api.save_my_notification_prefs',
})

function persist() {
  saver.submit(
    {
      prefs: rows.value.map((r) => ({
        grain_key: r.grain_key,
        enabled: r.enabled,
      })),
    },
    {
      onError: () => {
        prefs.reload() // revert the optimistic toggle to the server truth
        toast.error(__('Could not save — please try again.'))
      },
    },
  )
}

function toggleGrain(row, val) {
  row.enabled = val // optimistic; persist() reverts via reload on error
  persist()
}

// Master push toggle reflects the live browser permission, not a stored flag. Granting it
// drives the FCM registration/permission prompt; revoking is one-way (the rep clears it in
// site settings), so we point them there rather than fake a state we cannot change.
const pushOn = ref(
  typeof Notification !== 'undefined' && Notification.permission === 'granted',
)

async function togglePush(val) {
  if (val) {
    await initTatvaPush()
    pushOn.value =
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    if (!pushOn.value) {
      toast.error(
        __('Enable notifications for this site in your browser settings.'),
      )
    }
  } else {
    pushOn.value = false
    toast.info(
      __('Turn off notifications for this site in your browser settings.'),
    )
  }
}
</script>
