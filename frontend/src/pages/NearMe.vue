<!--
  NearMe — first-class native page replacing the retired Near Me form-script hack. A Leaflet map
  (left on desktop / top on mobile) + a scrollable list of doctor cards (right panel / bottom sheet).
  All data is server-side: device GPS → reverse_geocode for the address line + doctors_in_territory
  for the list/markers. The call path reuses the CRM's existing telephony (globalStore.makeCall) on
  desktop; mobile/PWA falls back to the system dialer. No business logic here — pure presentation
  over tatva_connect endpoints.
-->
<template>
  <LayoutHeader>
    <template #left-header>
      <div class="flex items-center gap-2 text-lg font-semibold text-ink-gray-9">
        <FeatherIcon name="map-pin" class="h-5 w-5" />
        {{ __('Near Me') }}
      </div>
    </template>
    <template #right-header>
      <!-- search -->
      <Popover placement="bottom-end">
        <template #target="{ togglePopover }">
          <Button variant="ghost" @click="togglePopover">
            <template #icon><FeatherIcon name="search" class="h-4 w-4" /></template>
          </Button>
        </template>
        <template #body-main>
          <div class="p-2">
            <FormControl
              v-model="search"
              type="text"
              :placeholder="__('Search by name or address')"
            />
          </div>
        </template>
      </Popover>
      <!-- filter -->
      <Popover placement="bottom-end">
        <template #target="{ togglePopover }">
          <Button variant="ghost" @click="togglePopover">
            <template #icon><FeatherIcon name="filter" class="h-4 w-4" /></template>
          </Button>
        </template>
        <template #body-main>
          <div class="flex w-56 flex-col gap-3 p-3">
            <FormControl
              v-model="filterStage"
              type="select"
              :label="__('Stage')"
              :options="stageOptions"
            />
            <FormControl
              v-model="filterSource"
              type="select"
              :label="__('Source')"
              :options="sourceOptions"
            />
            <FormControl
              v-model="filterGrain"
              type="select"
              :label="__('Business line')"
              :options="grainOptions"
            />
            <Button :label="__('Clear filters')" @click="clearFilters" />
          </div>
        </template>
      </Popover>
    </template>
  </LayoutHeader>

  <div class="flex h-full flex-col overflow-hidden md:flex-row">
    <!-- MAP : top on mobile, left ~55% on desktop -->
    <div class="relative h-[45vh] w-full md:h-full md:w-[55%]">
      <TatvaTerritoryMap
        v-if="here"
        :here="here"
        :doctors="filteredDoctors"
        :radiusKm="radiusKm"
        :focus="focus"
        @select="selectDoctor"
      />
      <div
        v-else
        class="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <FeatherIcon name="map-pin" class="h-8 w-8 text-ink-gray-4" />
        <div class="text-base text-ink-gray-6">{{ locationMessage }}</div>
        <Button
          v-if="locationDenied"
          variant="solid"
          :label="__('Retry')"
          @click="locate"
        />
      </div>
    </div>

    <!-- LIST : bottom sheet on mobile, right ~45% on desktop -->
    <div
      class="flex min-h-0 flex-1 flex-col border-t border-outline-gray-1 bg-surface-white md:max-w-[45%] md:border-l md:border-t-0"
    >
      <!-- mobile grab handle -->
      <div class="flex justify-center py-1.5 md:hidden">
        <div class="h-1 w-10 rounded-full bg-surface-gray-3" />
      </div>

      <div class="flex flex-col gap-2 px-4 pb-3 pt-1 md:pt-4">
        <div class="flex items-center gap-2 text-base text-ink-gray-7">
          <span class="font-medium text-ink-gray-9">{{ filteredDoctors.length }}</span>
          {{ __('doctor(s) within') }}
          <Select
            :modelValue="radiusKm"
            :options="radiusOptions"
            class="w-24"
            @update:modelValue="onRadiusChange"
          />
        </div>
        <div v-if="deviceAddress" class="truncate text-sm text-ink-gray-5">
          <FeatherIcon name="navigation" class="mr-1 inline h-3.5 w-3.5" />
          {{ deviceAddress }}
        </div>
        <FormControl
          v-model="search"
          type="text"
          :placeholder="__('Filter loaded list')"
        />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div v-if="loading" class="py-8 text-center text-sm text-ink-gray-5">
          {{ __('Loading…') }}
        </div>
        <div
          v-else-if="!filteredDoctors.length"
          class="py-8 text-center text-sm text-ink-gray-5"
        >
          {{ here ? __('No doctors in this radius.') : locationMessage }}
        </div>
        <div v-else class="flex flex-col gap-2">
          <TatvaDoctorCard
            v-for="d in filteredDoctors"
            :key="d.name"
            :doctor="d"
            :telephony="callEnabled"
            :isMobile="isMobile"
            @select="selectDoctor"
            @call="onCall"
            @directions="onDirections"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- desktop telephony chooser -->
  <Dialog
    v-model="showCallDialog"
    :options="{
      title: __('Call {0}', [callTarget?.title || '']),
      actions: [
        { label: __('Call via telephony'), variant: 'solid', onClick: callViaTelephony },
        { label: __('Open phone dialer'), onClick: callViaDialer },
      ],
    }"
  >
    <template #body-content>
      <div class="text-base text-ink-gray-6">{{ callTarget?.mobile_no }}</div>
    </template>
  </Dialog>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import TatvaTerritoryMap from '@/tatva/TatvaTerritoryMap.vue'
import TatvaDoctorCard from '@/tatva/TatvaDoctorCard.vue'
import { callEnabled } from '@/composables/telephony'
import { globalStore } from '@/stores/global'
import { Button, FeatherIcon, FormControl, Select, Popover, Dialog, call, toast } from 'frappe-ui'
import { computed, ref, onMounted } from 'vue'

const { makeCall } = globalStore()

const here = ref(null)
const deviceAddress = ref('')
const doctors = ref([])
const loading = ref(false)
const locationDenied = ref(false)
const locationMessage = ref(__('Getting your location…'))

const radiusKm = ref(15)
function onRadiusChange(v) {
  radiusKm.value = Number(v) || 15
  loadDoctors()
}
const radiusOptions = [
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '15 km', value: 15 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
]

const search = ref('')
const filterStage = ref('')
const filterSource = ref('')
const filterGrain = ref('')
const focus = ref(null)

// PWA / mobile detection → use the system dialer (a desk telephony popup makes no sense there).
const isMobile =
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(pointer: coarse)').matches ||
      'ontouchstart' in window)) ||
  false

function distinct(field) {
  const vals = [...new Set(doctors.value.map((d) => d[field]).filter(Boolean))].sort()
  return ['', ...vals].map((v) => ({ label: v || __('All'), value: v }))
}
const stageOptions = computed(() => distinct('stage'))
const sourceOptions = computed(() => distinct('source'))
const grainOptions = computed(() => distinct('grain'))

const filteredDoctors = computed(() => {
  const q = search.value.trim().toLowerCase()
  return doctors.value.filter((d) => {
    if (filterStage.value && d.stage !== filterStage.value) return false
    if (filterSource.value && d.source !== filterSource.value) return false
    if (filterGrain.value && d.grain !== filterGrain.value) return false
    if (q) {
      const hay = `${d.title || ''} ${d.address || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

function clearFilters() {
  filterStage.value = ''
  filterSource.value = ''
  filterGrain.value = ''
}

function selectDoctor(d) {
  if (d.lat != null && d.lng != null) focus.value = { lat: d.lat, lng: d.lng }
}

function locate() {
  locationDenied.value = false
  locationMessage.value = __('Getting your location…')
  if (!navigator.geolocation) {
    locationDenied.value = true
    locationMessage.value = __('Location is not available on this device.')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      here.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      reverseGeocode()
      loadDoctors()
    },
    () => {
      locationDenied.value = true
      locationMessage.value = __('Location permission denied. Enable it and retry.')
    },
    { enableHighAccuracy: true, timeout: 15000 },
  )
}

async function reverseGeocode() {
  try {
    const r = await call('tatva_connect.location.api.reverse_geocode', {
      lat: here.value.lat,
      lng: here.value.lng,
    })
    deviceAddress.value = (r && r.address) || ''
  } catch {
    deviceAddress.value = ''
  }
}

async function loadDoctors() {
  if (!here.value) return
  loading.value = true
  try {
    const r = await call('tatva_connect.near_me.api.doctors_in_territory', {
      lat: here.value.lat,
      lng: here.value.lng,
      radius_km: radiusKm.value,
    })
    doctors.value = Array.isArray(r) ? r : []
  } catch (e) {
    doctors.value = []
    toast.error(__('You do not have access to Near Me.'))
  } finally {
    loading.value = false
  }
}

// ----- call / directions -----
const showCallDialog = ref(false)
const callTarget = ref(null)

function onCall(d) {
  if (!d.mobile_no) return
  if (isMobile || !callEnabled.value) {
    window.location.href = 'tel:' + d.mobile_no
    return
  }
  callTarget.value = d
  showCallDialog.value = true
}

function callViaTelephony() {
  showCallDialog.value = false
  if (callTarget.value?.mobile_no) makeCall(callTarget.value.mobile_no)
}

function callViaDialer() {
  showCallDialog.value = false
  if (callTarget.value?.mobile_no) window.location.href = 'tel:' + callTarget.value.mobile_no
}

function onDirections(d) {
  if (d.lat == null || d.lng == null) return
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`,
    '_blank',
    'noopener',
  )
}

onMounted(locate)
</script>
