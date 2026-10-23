<template>
  <!-- DoctorDetail — one doctor, inline in the Near Me panel: band, name, actions, then one row per fact the list already carries. ✕ returns to the list. -->
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- The brand band: lavender → coral → amber, from the three --tatva-band-* tokens index.css declares for both themes. -->
    <div
      class="tatva-doctor-band relative h-24 shrink-0 border-b border-outline-gray-1"
    >
      <button
        type="button"
        :title="__('Back to list')"
        :aria-label="__('Back to list')"
        class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface-white text-ink-gray-7 shadow-sm hover:bg-surface-gray-2"
        @click="emit('close')"
      >
        <FeatherIcon name="x" class="h-4 w-4" />
      </button>
      <!-- The tile is the panel's own surface cut into the band's edge, so it separates from the band and the avatar's gray-2 fill (ui-rules/06). -->
      <div
        class="absolute -bottom-6 left-4 rounded-xl bg-surface-white p-1 shadow-sm"
      >
        <Avatar
          :image="doctor.image"
          :label="doctor.image_label || doctor.title || doctor.name"
          size="3xl"
          shape="square"
        />
      </div>
    </div>

    <div
      data-sheet-scroll
      class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-9"
    >
      <div class="flex flex-col gap-1">
        <div class="text-xl font-semibold text-ink-gray-9">
          {{ doctor.title || doctor.name }}
        </div>
        <div v-if="meta" class="text-sm text-ink-gray-6">{{ meta }}</div>
      </div>

      <DoctorActions
        :doctor="doctor"
        @directions="emit('directions', doctor)"
        @call="emit('call', doctor)"
        @whatsapp="emit('whatsapp', doctor)"
        @open="emit('open', doctor)"
      />

      <div
        class="flex flex-col divide-y divide-outline-gray-1 border-t border-outline-gray-1"
      >
        <div
          v-for="row in rows"
          :key="row.icon"
          class="flex items-start gap-3 py-3"
        >
          <FeatherIcon
            :name="row.icon"
            class="mt-0.5 h-4 w-4 shrink-0 text-ink-gray-5"
          />
          <div class="min-w-0 flex-1 break-words text-base text-ink-gray-8">
            {{ row.value }}
          </div>
        </div>
      </div>

      <DoctorActivity :lead="doctor.name" @open="emit('open', doctor)" />
    </div>
  </div>
</template>

<script setup>
import { Avatar, FeatherIcon } from 'frappe-ui'
import { computed } from 'vue'
import DoctorActions from '@/tatva/nearme/DoctorActions.vue'
import DoctorActivity from '@/tatva/nearme/DoctorActivity.vue'
import { doctorMeta } from '@/tatva/nearme/doctorMeta'

const props = defineProps({
  doctor: { type: Object, required: true },
  territory: { type: Object, default: null }, // { data: reply } — the stage title's `_link_titles` source
  showGrain: { type: Boolean, default: true },
})

const emit = defineEmits(['close', 'directions', 'call', 'whatsapp', 'open'])

const meta = computed(() =>
  doctorMeta(props.doctor, props.territory, props.showGrain),
)

// The facts the meta line does not already say (stage and business line live there), from the list read itself.
const rows = computed(() =>
  [
    { icon: 'home', value: props.doctor.clinic },
    { icon: 'map-pin', value: props.doctor.address },
    { icon: 'phone', value: props.doctor.mobile_no },
    { icon: 'log-in', value: props.doctor.source },
  ].filter((r) => r.value),
)
</script>

<style scoped>
/* The brand values live once, in index.css (--tatva-band-*), with their dark-theme twins. */
.tatva-doctor-band {
  background: linear-gradient(135deg, var(--tatva-band-1), var(--tatva-band-2), var(--tatva-band-3));
}
</style>
