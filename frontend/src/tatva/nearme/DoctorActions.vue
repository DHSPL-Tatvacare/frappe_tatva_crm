<template>
  <!-- DoctorActions — the ONE Directions · Call · WhatsApp · Open lead row, shared by the map's hover card and the detail panel. -->
  <!-- Icon over label (the Maps pattern) so four fit a 320px card; an action the doctor cannot support is absent (C5). Fills are frappe-ui Button's own gray solid/subtle tokens. -->
  <div class="flex gap-1" @click.stop>
    <button
      v-for="a in actions"
      :key="a.event"
      type="button"
      class="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1"
      @click="emit(a.event, doctor)"
    >
      <span
        class="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
        :class="
          a.primary
            ? 'bg-surface-gray-7 text-ink-white group-hover:bg-surface-gray-6'
            : 'bg-surface-gray-2 text-ink-gray-8 group-hover:bg-surface-gray-3'
        "
      >
        <WhatsAppIcon v-if="a.event === 'whatsapp'" class="h-4 w-4" />
        <FeatherIcon v-else :name="a.icon" class="h-4 w-4" />
      </span>
      <span class="max-w-full truncate text-xs text-ink-gray-7">{{
        a.label
      }}</span>
    </button>
  </div>
</template>

<script setup>
import { FeatherIcon } from 'frappe-ui'
import { computed } from 'vue'
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import { whatsappUrl } from '@/tatva/nearme/doctorMeta'

const props = defineProps({
  doctor: { type: Object, required: true },
})

const emit = defineEmits(['directions', 'call', 'whatsapp', 'open'])

const actions = computed(() => {
  const d = props.doctor
  return [
    d.lat != null &&
      d.lng != null && {
        event: 'directions',
        icon: 'navigation',
        label: __('Directions'),
        primary: true,
      },
    d.mobile_no && { event: 'call', icon: 'phone', label: __('Call') },
    whatsappUrl(d) && { event: 'whatsapp', label: __('WhatsApp') },
    { event: 'open', icon: 'external-link', label: __('Open lead') },
  ].filter(Boolean)
})
</script>
