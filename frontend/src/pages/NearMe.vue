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
      <div class="text-lg font-medium text-ink-gray-7">{{ __('Near Me') }}</div>
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
        v-if="origin"
        ref="mapRef"
        :here="device"
        :origin="origin"
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

      <!-- recenter on my location — also the way back after searching another area -->
      <button
        v-if="device"
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

      <!-- count + radius + where we are searching + search -->
      <div class="flex shrink-0 flex-col gap-2 px-4 pb-3 pt-1 md:pt-4">
        <div class="flex items-center gap-1.5 whitespace-nowrap text-sm text-ink-gray-7">
          <span class="font-semibold text-ink-gray-9">{{ filteredDoctors.length }}</span>
          {{ __('within') }}
          <Select
            :modelValue="radiusKm ? String(radiusKm) : ''"
            :options="radiusOptions"
            size="sm"
            class="w-[86px]"
            @update:modelValue="onRadiusChange"
          />
        </div>
        <div v-if="originAddress" class="flex items-center gap-1 text-xs text-ink-gray-5">
          <FeatherIcon :name="searchedArea ? 'map-pin' : 'navigation'" class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ originAddress }}</span>
        </div>
        <FormControl
          v-model="search"
          type="text"
          :placeholder="__('Search a doctor, or an area to jump to')"
        >
          <template #prefix><FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" /></template>
        </FormControl>

        <!-- Places that match what was typed. Picking one moves the search to that area — the reason a
             rep can look at tomorrow's territory, and the reason a UAE bench is testable from Bengaluru. -->
        <div
          v-if="areaResults.length"
          class="flex flex-col overflow-hidden rounded-lg border border-outline-gray-2"
        >
          <button
            v-for="(place, i) in areaResults"
            :key="i"
            type="button"
            class="flex items-start gap-2 border-b border-outline-gray-1 px-3 py-2 text-left text-sm text-ink-gray-7 last:border-b-0 hover:bg-surface-gray-2"
            @click="goToArea(place)"
          >
            <FeatherIcon name="map-pin" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-gray-5" />
            <span class="line-clamp-2">{{ place.address }}</span>
          </button>
        </div>
      </div>

      <!-- cards -->
      <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div v-if="loading" class="py-8 text-center text-sm text-ink-gray-5">
          {{ __('Loading…') }}
        </div>
        <div v-else-if="!filteredDoctors.length" class="py-8 text-center text-sm text-ink-gray-5">
          <!-- The radius here is the one the server actually searched, so an empty list says how far it
               looked instead of implying a number the user never chose. -->
          {{ origin ? __('No doctors within {0} km.', [radiusKm]) : locationMessage }}
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

  <!-- telephony chooser — the stock Dialog on desktop, a bottom sheet in the PWA. The buttons live in
       the #actions slot because that is the slot a sheet turns into its sticky footer; `options.actions`
       would render on desktop only and leave mobile with no way to place the call. -->
  <ResponsiveDialog
    v-model="showCallDialog"
    :options="{ title: __('Call {0}', [callTarget?.title || '']), size: 'sm' }"
  >
    <template #body-content>
      <div class="text-base text-ink-gray-6">{{ callTarget?.mobile_no }}</div>
    </template>
    <template #actions>
      <div class="flex flex-col gap-2">
        <Button variant="solid" :label="__('Call via telephony')" @click="callViaTelephony" />
        <Button :label="__('Open phone dialer')" @click="callViaDialer" />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import LayoutHeader from '@/components/LayoutHeader.vue'
import TatvaTerritoryMap from '@/tatva/TatvaTerritoryMap.vue'
import TatvaDoctorCard from '@/tatva/TatvaDoctorCard.vue'
import { callEnabled } from '@/composables/telephony'
import { globalStore } from '@/stores/global'
import { Button, FeatherIcon, FormControl, Select, Popover, call, toast } from 'frappe-ui'
import { computed, ref, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useSheetDrag } from '@/composables/useSheetDrag'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'

const { makeCall } = globalStore()

const mapRef = ref(null)
// `device` is where the rep physically is (the pulsing dot); `origin` is the point being searched
// around. They are the same until an area is searched, and the crosshair puts them back together.
const device = ref(null)
const origin = ref(null)
const originAddress = ref('')
const searchedArea = ref(false)
const doctors = ref([])
const loading = ref(false)
const locationDenied = ref(false)
const locationMessage = ref(__('Getting your location…'))

// Null until the server answers: on first load IT picks the radius, walking outwards until it finds
// doctors, so the page cannot open on an empty list merely because a number in the client was too
// small. Once the user picks from the dropdown, that choice is sent and honoured exactly.
const radiusKm = ref(null)
const radiusOptions = [
  { label: '5 km', value: '5' },
  { label: '10 km', value: '10' },
  { label: '15 km', value: '15' },
  { label: '30 km', value: '30' },
  { label: '60 km', value: '60' },
  { label: '120 km', value: '120' },
]

function onRadiusChange(v) {
  radiusKm.value = Number(v) || null
  loadDoctors({ radius: radiusKm.value })
}

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

// ---- draggable bottom sheet (mobile only) — the shared engine (drag + snap + body scroll lock) ----
const { sheetStyle, onDragStart, onDragMove, onDragEnd } = useSheetDrag({
  collapsed: 0.42,
  expanded: 0.85,
  min: 0.16,
})

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

// The crosshair: back to the rep's own position, and out of a searched area.
function recenter() {
  if (!device.value) return
  if (searchedArea.value) {
    searchedArea.value = false
    origin.value = device.value
    reverseGeocode()
    loadDoctors({ radius: radiusKm.value })
  }
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
      device.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      origin.value = device.value
      reverseGeocode()
      loadDoctors() // no radius: the server walks outwards and tells us which one answered
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
      lat: origin.value.lat,
      lng: origin.value.lng,
    })
    originAddress.value = (r && r.address) || ''
  } catch {
    originAddress.value = ''
  }
}

async function loadDoctors({ radius = null } = {}) {
  if (!origin.value) return
  loading.value = true
  try {
    // radius_km omitted => the server's ladder decides and reports back; passed => searched exactly.
    const args = { lat: origin.value.lat, lng: origin.value.lng }
    if (radius) args.radius_km = radius
    const r = await call('tatva_connect.near_me.api.doctors_in_territory', args)
    doctors.value = r?.doctors || []
    radiusKm.value = Number(r?.radius_km) || radiusKm.value
  } catch {
    doctors.value = []
    toast.error(__('You do not have access to Near Me.'))
  } finally {
    loading.value = false
  }
}

// ---- area search --------------------------------------------------------------------------
// The box filters the loaded doctors AND offers places to jump to. Before this, it only filtered what
// was already on screen, so a territory the rep was not standing in could never be looked at at all.
const areaResults = ref([])

const searchArea = useDebounceFn(async (q) => {
  if (q.trim().length < 3) {
    areaResults.value = []
    return
  }
  try {
    const r = await call('tatva_connect.location.api.geocode_search', { query: q.trim() })
    // A doctor already on screen answers the query; only offer areas when nothing local matches.
    areaResults.value = filteredDoctors.value.length ? [] : r || []
  } catch {
    areaResults.value = []
  }
}, 400)

watch(search, (q) => searchArea(q))

function goToArea(place) {
  searchedArea.value = true
  origin.value = { lat: place.lat, lng: place.lng }
  originAddress.value = place.address
  areaResults.value = []
  search.value = ''
  loadDoctors({ radius: radiusKm.value })
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

onMounted(locate)
</script>
