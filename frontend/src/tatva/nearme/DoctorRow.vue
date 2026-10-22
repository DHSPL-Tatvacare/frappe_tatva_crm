<template>
  <!-- DoctorRow — one doctor row in the Near Me list (and the body of the map's hover card): square avatar, name, `stage · distance`, address. -->
  <!-- Every row renders the same three lines whatever the data holds, so the list is a clean stack. Clicking emits `select`; the page opens the detail. -->
  <div
    class="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
    :class="selected ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-1'"
    @click="emit('select', doctor)"
  >
    <!-- Avatar's empty fill is surface-gray-2, the selected row's own token, so it sits on a white tile (ui-rules/06). -->
    <div
      class="relative shrink-0 rounded-[10px] bg-surface-white ring-1 ring-outline-gray-2"
    >
      <!-- A stop's place in the day, the same number its pin wears on the map. -->
      <span
        v-if="index"
        class="absolute -left-1.5 -top-1.5 z-[1] flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-gray-7 px-1 text-xs font-medium tabular-nums text-ink-white ring-2 ring-outline-white"
      >
        {{ index }}
      </span>
      <!-- N-6: labelled by `image_label` (first_name); the title carries the salutation and drew "D" on every doctor. -->
      <Avatar
        :image="doctor.image"
        :label="doctor.image_label || doctor.title || doctor.name"
        size="3xl"
        shape="square"
      />
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="truncate text-base font-medium text-ink-gray-9">
        {{ doctor.title || doctor.name }}
      </div>
      <!-- A stop says why the rep is going (its task) before the stage; a registry row says where it is. -->
      <div v-if="caption" class="truncate text-sm text-ink-gray-7">
        {{ caption }}
      </div>
      <div class="truncate text-sm text-ink-gray-6">{{ meta || '—' }}</div>
      <div v-if="!caption" class="truncate text-sm text-ink-gray-5">
        {{ doctor.address || '—' }}
      </div>
    </div>

    <!-- C5: absent, not disabled. Mobile keeps one-tap call; every other action lives in the detail panel. -->
    <Button
      v-if="callable && doctor.mobile_no"
      variant="ghost"
      :tooltip="__('Call')"
      @click.stop="emit('call', doctor)"
    >
      <template #icon><FeatherIcon name="phone" class="h-4 w-4" /></template>
    </Button>
  </div>
</template>

<script setup>
import { Avatar, Button, FeatherIcon } from 'frappe-ui'
import { computed } from 'vue'
import { doctorMeta } from '@/tatva/nearme/doctorMeta'

const props = defineProps({
  doctor: { type: Object, required: true },
  territory: { type: Object, default: null }, // { data: reply } — the stage title's `_link_titles` source
  selected: { type: Boolean, default: false }, // C4 — the one selected state, owned by the page
  showGrain: { type: Boolean, default: true }, // C8 — the page knows whether the territory is mixed
  callable: { type: Boolean, default: false }, // a one-tap call icon (mobile rows)
  index: { type: Number, default: 0 }, // a My day stop number; 0 = a registry row
  caption: { type: String, default: '' }, // a My day stop's task line, in place of the address
})

const emit = defineEmits(['select', 'call'])

const meta = computed(() =>
  doctorMeta(props.doctor, props.territory, props.showGrain),
)
</script>
