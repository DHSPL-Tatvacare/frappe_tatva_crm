<!-- TATVA: Notifications, screen 2b — email. Writes frappe's own per-user Notification Settings, the doc
     notification_log.after_insert already reads, so there is no second store. No operator gate: whether a
     person wants mail is theirs. The master is not cosmetic — off means nothing sends, so rows disable. -->
<template>
  <div class="flex h-full flex-col gap-6 p-6 text-ink-gray-8">
    <div class="flex px-2 pt-2">
      <Button
        variant="ghost"
        icon-left="chevron-left"
        :label="__('Email notifications')"
        size="md"
        class="-ml-4 cursor-pointer !justify-start text-xl font-semibold hover:bg-transparent hover:opacity-70 focus:bg-transparent focus:outline-none focus:ring-0"
        @click="updateStep('list')"
      />
    </div>

    <div
      v-if="emailPrefs.loading && !emailPrefs.data"
      class="mt-16 flex w-full justify-center"
    >
      <Button :loading="true" variant="ghost" size="2xl" />
    </div>

    <template v-else-if="master">
      <!-- Global -->
      <div class="flex flex-col">
        <div class="flex items-center px-4 py-2 text-sm text-ink-gray-5">
          {{ __('Email') }}
        </div>
        <div class="mx-4 h-px border-t border-outline-gray-modals" />
        <NotificationToggleRow
          :label="master.label"
          :description="master.description"
          :model-value="master.enabled"
          @update:model-value="(val) => toggleField(master, val)"
        />
      </div>

      <!-- Per-kind -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <div class="flex items-center px-4 py-2 text-sm text-ink-gray-5">
          {{ __('Email me about') }}
        </div>
        <div class="mx-4 h-px border-t border-outline-gray-modals" />
        <ul class="overflow-y-auto px-2">
          <template v-for="(row, i) in rows" :key="row.fieldname">
            <NotificationToggleRow
              :label="row.label"
              :description="
                master.enabled ? row.description : __('Turn on Email to use this')
              "
              :model-value="row.enabled"
              :disabled="!master.enabled"
              :muted="!master.enabled"
              @update:model-value="(val) => toggleField(row, val)"
            />
            <div
              v-if="i !== rows.length - 1"
              class="mx-2 h-px border-t border-outline-gray-modals"
            />
          </template>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Button, createResource, toast } from 'frappe-ui'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'

const updateStep = inject('updateStep')
const emailPrefs = inject('emailPrefs')

const master = computed(() => emailPrefs.data?.master)
const rows = computed(() => emailPrefs.data?.rows || [])

const saver = createResource({
  url: 'tatva_connect.notifications.api.save_my_email_prefs',
})

// One payload shape for the master and the rows alike — both are just fieldnames on the same doc, so
// there is no separate "save the master" path to keep in step with this one.
function toggleField(field, val) {
  field.enabled = val // optimistic — reverted from the server on error
  const payload = { [master.value.fieldname]: master.value.enabled }
  rows.value.forEach((r) => {
    payload[r.fieldname] = r.enabled
  })
  saver.submit(
    { prefs: payload },
    {
      onError: () => {
        emailPrefs.reload()
        toast.error(__('Could not save — please try again.'))
      },
    },
  )
}
</script>
