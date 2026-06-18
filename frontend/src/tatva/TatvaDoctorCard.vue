<!--
  TatvaDoctorCard — one doctor in the Near Me list. Pure presentation: round Avatar (image or
  auto-colour initials from title), bold name, a dot-separated meta line (stage · source · distance),
  a truncated address, a grain Badge, and two icon Buttons (call + directions). Clicking the body
  emits `select` so the page centres the map; the buttons emit `call` / `directions`. No business
  logic — distance/labels arrive server-side; the call/directions wiring lives in the page.
-->
<template>
  <div
    class="flex cursor-pointer items-start gap-3 rounded-lg border border-outline-gray-1 bg-surface-white p-3 transition-colors hover:bg-surface-gray-1"
    @click="emit('select', doctor)"
  >
    <Avatar
      :image="doctor.image"
      :label="doctor.title || doctor.name"
      size="lg"
      shape="circle"
      class="flex-shrink-0"
    />
    <div class="min-w-0 flex-1">
      <div class="truncate text-base font-semibold text-ink-gray-9">
        {{ doctor.title || doctor.name }}
      </div>
      <div class="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-ink-gray-5">
        <span v-if="doctor.stage">{{ doctor.stage }}</span>
        <span v-if="doctor.stage && doctor.source">·</span>
        <span v-if="doctor.source">{{ doctor.source }}</span>
        <span v-if="(doctor.stage || doctor.source) && distanceLabel">·</span>
        <span v-if="distanceLabel">{{ distanceLabel }}</span>
      </div>
      <div v-if="doctor.address" class="mt-0.5 truncate text-sm text-ink-gray-5">
        {{ doctor.address }}
      </div>
      <Badge
        v-if="doctor.grain"
        class="mt-1.5"
        variant="subtle"
        theme="gray"
        size="sm"
        :label="doctor.grain"
      />
    </div>
    <div class="flex flex-shrink-0 flex-col gap-1.5" @click.stop>
      <Button
        variant="subtle"
        theme="gray"
        :disabled="!doctor.mobile_no"
        :label="__('Call')"
        @click="emit('call', doctor)"
      >
        <template #icon>
          <FeatherIcon name="phone" class="h-4 w-4" />
        </template>
      </Button>
      <Button
        variant="subtle"
        theme="gray"
        :disabled="doctor.lat == null || doctor.lng == null"
        :label="__('Directions')"
        @click="emit('directions', doctor)"
      >
        <template #icon>
          <FeatherIcon name="navigation" class="h-4 w-4" />
        </template>
      </Button>
    </div>
  </div>
</template>

<script setup>
import { Avatar, Badge, Button, FeatherIcon } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps({
  doctor: { type: Object, required: true },
  telephony: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false },
})

const emit = defineEmits(['call', 'directions', 'select'])

const distanceLabel = computed(() => {
  const m = props.doctor?.distance_m
  if (m == null) return ''
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
})
</script>
