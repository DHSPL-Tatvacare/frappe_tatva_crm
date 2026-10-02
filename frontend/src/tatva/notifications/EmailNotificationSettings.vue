<!-- TATVA: Notifications, screen 2b — email. Frappe's own per-user email switches, which notification_log already reads, so there is no second store; the email master gates the rows below it. -->
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

    <div class="flex flex-col">
      <div class="flex items-center px-4 py-2 text-sm text-ink-gray-5">
        {{ __('Email') }}
      </div>
      <div class="mx-4 h-px border-t border-outline-gray-modals" />
      <NotificationToggleRow
        :label="email.master.label"
        :description="
          masterOn
            ? email.master.description
            : __('Turn on System notifications to use this')
        "
        :model-value="email.master.enabled"
        :disabled="!masterOn"
        :muted="!masterOn"
        @update:model-value="(val) => saveSetting(email.master, val)"
      />
    </div>

    <div class="flex flex-1 flex-col overflow-hidden">
      <div class="flex items-center px-4 py-2 text-sm text-ink-gray-5">
        {{ __('Email me') }}
      </div>
      <div class="mx-4 h-px border-t border-outline-gray-modals" />
      <ul class="overflow-y-auto px-2">
        <template v-for="(row, i) in email.rows" :key="row.fieldname">
          <NotificationToggleRow
            :label="row.label"
            :description="
              rowsOn
                ? row.description
                : masterOn
                  ? __('Turn on Email notifications to use this')
                  : __('Turn on System notifications to use this')
            "
            :model-value="row.enabled"
            :disabled="!rowsOn"
            :muted="!rowsOn"
            @update:model-value="(val) => saveSetting(row, val)"
          />
          <div
            v-if="i !== email.rows.length - 1"
            class="mx-2 h-px border-t border-outline-gray-modals"
          />
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Button } from 'frappe-ui'
import NotificationToggleRow from '@/tatva/notifications/NotificationToggleRow.vue'

const updateStep = inject('updateStep')
const settings = inject('settings')
const saveSetting = inject('saveSetting')

const email = computed(() => settings.data.email)
const masterOn = computed(() => settings.data.master.enabled)
const rowsOn = computed(() => masterOn.value && email.value.master.enabled)
</script>
