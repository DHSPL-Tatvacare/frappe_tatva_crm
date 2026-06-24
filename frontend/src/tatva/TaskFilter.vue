<!-- TATVA: Tasks board filter (status + task type). Reads/writes the shared taskFilter; client-side only. -->
<template>
  <Popover placement="bottom-end">
    <template #target="{ togglePopover }">
      <Button
        :label="count ? `${__('Filter')} (${count})` : __('Filter')"
        icon-left="filter"
        :class="count ? '!bg-surface-gray-3' : ''"
        @click="togglePopover"
      />
    </template>
    <template #body-main>
      <div class="w-56 p-3">
        <div v-if="taskFilter.statuses.length">
          <div class="mb-1.5 text-xs font-medium text-ink-gray-5">{{ __('Status') }}</div>
          <label
            v-for="s in taskFilter.statuses"
            :key="s"
            class="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink-gray-8"
          >
            <Checkbox
              :modelValue="taskFilter.status.includes(s)"
              @update:modelValue="() => toggle('status', s)"
            />
            {{ s }}
          </label>
        </div>

        <div v-if="taskFilter.taskTypes.length" class="mt-3">
          <div class="mb-1.5 text-xs font-medium text-ink-gray-5">{{ __('Task Type') }}</div>
          <label
            v-for="t in taskFilter.taskTypes"
            :key="t"
            class="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink-gray-8"
          >
            <Checkbox
              :modelValue="taskFilter.type.includes(t)"
              @update:modelValue="() => toggle('type', t)"
            />
            <span class="truncate">{{ t }}</span>
          </label>
        </div>

        <div v-if="count" class="mt-3 border-t border-outline-gray-1 pt-2">
          <button
            class="text-sm text-ink-gray-5 hover:text-ink-gray-8"
            @click="clearAll"
          >
            {{ __('Clear filters') }}
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>

<script setup>
import { computed } from 'vue'
import { Popover, Button, Checkbox } from 'frappe-ui'
import { taskFilter, taskFilterCount } from '@/tatva/taskFilter.js'

const count = computed(() => taskFilterCount())

function toggle(key, val) {
  const arr = taskFilter[key]
  const i = arr.indexOf(val)
  if (i === -1) arr.push(val)
  else arr.splice(i, 1)
}

function clearAll() {
  taskFilter.status = []
  taskFilter.type = []
}
</script>
