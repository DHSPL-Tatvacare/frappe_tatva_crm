<template>
  <!-- A fixed width, as Helpdesk's: frappe-ui's Select does not take a width from its parent's class. -->
  <div class="w-40 shrink-0">
    <Select
      :model-value="status"
      :options="options"
      :placeholder="__('Set status')"
      variant="subtle"
      @update:model-value="(s) => s !== status && setCheckin(s).catch(() => {})"
    >
      <template #prefix>
        <CheckinStatus :status="status" class="mr-1" />
      </template>
      <template #option="{ option }">
        <span class="flex items-center gap-2">
          <CheckinStatus :status="option.value" />
          {{ option.label }}
        </span>
      </template>
    </Select>
  </div>
</template>

<script setup>
// TATVA: the status picker on the Profile settings page, as Helpdesk's AvailabilityMenu: one select, a dot per status.
import { computed } from 'vue'
import { Select } from 'frappe-ui'
import CheckinStatus from '@/tatva/checkin/CheckinStatus.vue'
import { CHECKIN_STATUSES, useCheckin } from '@/tatva/checkin/useCheckin'

const { status, setCheckin } = useCheckin()
const options = computed(() =>
  CHECKIN_STATUSES.map((s) => ({ label: __(s), value: s })),
)
</script>
