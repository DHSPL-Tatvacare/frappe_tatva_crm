<!--
  NearMe — first-class native page replacing the retired Near Me form-script hack. An interactive map
  fills the view; the doctor list is a fixed side panel on desktop and a DRAGGABLE bottom sheet on
  mobile (peek ↔ expanded, snaps on release). One search, one filter, a compact radius picker, and a
  recenter crosshair. All data is server-side: device GPS → reverse_geocode (address line) +
  doctors_in_territory (list/markers). Desktop call reuses the CRM's telephony (globalStore.makeCall)
  when callEnabled; mobile/PWA uses the system dialer. No business logic — pure presentation.
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
      <Popover placement="bottom-end">
        <template #target="{ togglePopover }">
          <Button variant="ghost" @click="togglePopover">
            <template #icon><FeatherIcon name="filter" class="h-4 w-4" /></template>
          </Button>
        </template>
        <template #body-main>
          <div class="flex w-56 flex-col gap-3 p-3">
            <FormControl v-model="filterStage" type="select" :label="__('Stage')" :options="stageOptions" />
            <FormControl v-model="filterSource" type="select" :label="__('Source')" :options="sourceOptions" />
            <FormControl v-model="filterGrain" type="select" :label="__('Business line')" :options="grainOptions" />
            <Button :label="__('Clear filters')" @click="clearFilters" />
          </div>
        </template>
      </Popover>
    </template>
  </LayoutHeader>

  <div class="relative flex h-full overflow-hidden">
    <!-- MAP — fills the space; the list floats over it on mobile, sits beside it on desktop -->
    <div class="relative min-h-0 flex-1">
      <TatvaTerritoryMap
        v-if="here"
        ref="mapRef"
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
        <Button v-if="locationDenied" variant="solid" :label="__('Retry')" @click="locate" />
      </div>

      <!-- recenter on my location -->
      <button
        v-if="here"
        type="button"
        :title="__('Back to my location')"
        class="absolute right-3 top-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-full border border-outline-gray-2 bg-surface-white text-ink-gray-7 shadow-sm hover:bg-surface-gray-2"
        @click="recenter"
      >
        <FeatherIcon name="crosshair" class="h-5 w-5" />
      </button>
    </div>

    <!-- LIST — ONE element: desktop right column (fixed width) / mobile draggable bottom sheet -->
    <div
      class="absolute inset-x-0 bottom-0 z-20 flex max-h-[90vh] flex-col overflow-hidden rounded-t-2xl border-t border-outline-gray-2 bg-surface-white shadow-2xl md:static md:z-0 md:h-full md:max-h-none md:w-[360px] md:flex-none md:rounded-none md:border-l md:border-t-0 md:shadow-none"
      :style="sheetStyle"
    >
      <!-- drag handle (mobile only) -->
      <div
        class="flex shrink-0 cursor-grab touch-none justify-center py-2 md:hidden"
        @pointerdown="onDragStart"
        @pointermove="onDragMove"
        @pointerup="onDragEnd"
        @pointercancel="onDragEnd"
      >
        <div class="h-1.5 w-10 rounded-full bg-surface-gray-4" />
      </div>

      <!-- count + radius + address + search -->
      <div class="flex shrink-0 flex-col gap-2 px-4 pb-3 pt-1 md:pt-4">
        <div class="flex items-center gap-1.5 whitespace-nowrap text-sm text-ink-gray-7">
          <span class="font-semibold text-ink-gray-9">{{ filteredDoctors.length }}</span>
          {{ __('within') }}
          <Select
            :modelValue="String(radiusKm)"
            :options="radiusOptions"
            size="sm"
            class="w-[78px]"
            @update:modelValue="onRadiusChange"
          />
        </div>
        <div v-if="deviceAddress" class="flex items-center gap-1 text-xs text-ink-gray-5">
          <FeatherIcon name="navigation" class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ deviceAddress }}</span>
        </div>
        <FormControl v-model="search" type="text" :placeholder="__('Search name or address')">
          <template #prefix><FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" /></template>
        </FormControl>
      </div>

      <!-- cards -->
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div v-if="loading" class="py-8 text-center text-sm text-ink-gray-5">
          {{ __('Loading…') }}
        </div>
        <div v-else-if="!filteredDoctors.length" class="py-8 text-center text-sm text-ink-gray-5">
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
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

const { makeCall } = globalStore()

const mapRef = ref(null)
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
  { label: '5 km', value: '5' },
  { label: '10 km', value: '10' },
  { label: '15 km', value: '15' },
  { label: '25 km', value: '25' },
  { label: '50 km', value: '50' },
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

// ---- draggable bottom sheet (mobile only) -------------------------------------------------
const COLLAPSED = 0.42
const EXPANDED = 0.85
const MIN = 0.16
const sheetFrac = ref(COLLAPSED)
const isDragging = ref(false)
const isNarrow = ref(false)
let mql = null
let dragStartY = 0
let dragStartFrac = COLLAPSED

function onMqChange(e) {
  isNarrow.value = e.matches
}
function onDragStart(e) {
  isDragging.value = true
  dragStartY = e.clientY
  dragStartFrac = sheetFrac.value
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onDragMove(e) {
  if (!isDragging.value) return
  const dy = e.clientY - dragStartY
  const vh = window.innerHeight || 1
  sheetFrac.value = Math.min(EXPANDED, Math.max(MIN, dragStartFrac - dy / vh))
}
function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  sheetFrac.value = sheetFrac.value >= (COLLAPSED + EXPANDED) / 2 ? EXPANDED : COLLAPSED
}
const sheetStyle = computed(() =>
  isNarrow.value
    ? { height: `${(sheetFrac.value * 100).toFixed(1)}vh`, transition: isDragging.value ? 'none' : 'height 0.2s ease' }
    : {},
)

// ---- filters / search ---------------------------------------------------------------------
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

function recenter() {
  mapRef.value?.recenter?.()
}

// ---- data ---------------------------------------------------------------------------------
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

// ---- call / directions --------------------------------------------------------------------
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

// Open in a way the OS hands straight to the Maps app — avoids the orphan blank tab a PWA gets
// from window.open('_blank') in standalone mode.
function openExternal(url) {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
function onDirections(d) {
  if (d.lat == null || d.lng == null) return
  openExternal(`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`)
}

onMounted(() => {
  mql = window.matchMedia('(max-width: 767px)')
  isNarrow.value = mql.matches
  mql.addEventListener('change', onMqChange)
  locate()
})
onBeforeUnmount(() => mql && mql.removeEventListener('change', onMqChange))
</script>
