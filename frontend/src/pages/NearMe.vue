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
        :radiusKm="scope === 'search' ? 0 : radiusKm"
        :focus="focus"
        :selected="selectedName"
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

      <!-- recenter on my location; z-10 is the sticky-inside-a-panel band — it is a SIBLING of the map, so any positive value clears the whole map subtree (bands: TatvaBottomSheet). -->
      <button
        v-if="device"
        type="button"
        :title="__('Back to my location')"
        class="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-outline-gray-2 bg-surface-white text-ink-gray-7 shadow-sm hover:bg-surface-gray-2"
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
          <!-- The count carries the SAME narrowing as the list (C7): filtered shows "n of loaded",
               and a server-capped ring says so instead of posing as the whole territory (NM-05). -->
          <span class="font-semibold text-ink-gray-9">{{ countLabel }}</span>
          <!-- A name reaches the whole book, so the ring vocabulary goes with it: no "within", no radius picker, and the map draws no circle. -->
          <template v-if="scope === 'ring'">
            {{ __('within') }}
            <Select
              :modelValue="radiusKm ? String(radiusKm) : ''"
              :options="radiusOptions"
              size="sm"
              class="w-[86px]"
              @update:modelValue="onRadiusChange"
            />
          </template>
          <template v-else>{{
            __('matching “{0}”', [search.trim()])
          }}</template>
        </div>
        <div v-if="capped" class="text-xs text-ink-gray-5">
          {{ __('Only the nearest {0} are shown — narrow the radius to see everything in it.', [doctors.length]) }}
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
          <template v-if="!origin">{{ locationMessage }}</template>
          <template v-else-if="scope === 'search'">{{
            __('No doctor matching “{0}” has a clinic location.', [
              search.trim(),
            ])
          }}</template>
          <template v-else>{{
            __('Nothing with a clinic location within {0} km.', [radiusKm])
          }}</template>
        </div>
        <div v-else class="flex flex-col gap-2">
          <TatvaDoctorCard
            v-for="d in filteredDoctors"
            :key="d.name"
            :ref="(el) => registerCard(d.name, el)"
            :doctor="d"
            :selected="d.name === selectedName"
            :showGrain="territoryIsMixed"
            @select="selectDoctor"
            @call="onCall"
            @directions="onDirections"
            @open="openLead"
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
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { useSheetDrag } from '@/composables/useSheetDrag'
import { isMobileView, isStandalonePWA } from '@/composables/settings'
import { useMapConfig } from '@/composables/mapConfig'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'

const { makeCall } = globalStore()
const router = useRouter()

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
// The server said the ring held more rows than it returned (nearest-first) — the count line says so (C7).
const capped = ref(false)
// 'ring' (a place, with a radius) or 'search' (a name, the whole book) — set by the server, read by the panel.
const scope = ref('ring')

// One mobile brain (NM-10): a phone-sized viewport or an installed PWA uses the system dialer. The
// page-local `pointer: coarse` copy this replaces sent every touchscreen LAPTOP to the dialer too.
const useDialer = computed(() => isMobileView.value || isStandalonePWA)

// ---- draggable bottom sheet (mobile only) — the shared engine (drag + snap + body scroll lock) ----
// Named once, because selecting a doctor has to be able to REVEAL the row it highlighted: on a phone the
// panel may be at peek height, and a highlight hidden behind the sheet edge is not a highlight.
const SHEET = { collapsed: 0.42, expanded: 0.85, min: 0.16 }
const { sheetStyle, onDragStart, onDragMove, onDragEnd, sheetFrac, isNarrow } =
  useSheetDrag(SHEET)

// ---- filters / search ---------------------------------------------------------------------
function distinct(field) {
  const vals = [...new Set(doctors.value.map((d) => d[field]).filter(Boolean))].sort()
  return ['', ...vals].map((v) => ({ label: v || __('All'), value: v }))
}
const stageOptions = computed(() => distinct('stage'))
const sourceOptions = computed(() => distinct('source'))
const grainOptions = computed(() => distinct('grain'))

const filteredDoctors = computed(() => {
  return doctors.value.filter((d) => {
    if (filterStage.value && d.stage !== filterStage.value) return false
    if (filterSource.value && d.source !== filterSource.value) return false
    if (filterGrain.value && d.grain !== filterGrain.value) return false
    // No name branch: the SERVER matched the name (doctors_in_territory `q`), so filtering the rows it
    // returned would hide a match whose name lives in a field this row does not carry.
    return true
  })
})

// C8: the grain badge is information only when the territory actually spans more than one business line.
// On a single-line territory the same word on every card is a wasted line per row.
const territoryIsMixed = computed(
  () => new Set(doctors.value.map((d) => d.grain).filter(Boolean)).size > 1,
)

// "12 of 87" whenever a filter or search narrows the loaded set; the bare number when nothing does.
const countLabel = computed(() =>
  filteredDoctors.value.length === doctors.value.length
    ? String(doctors.value.length)
    : __('{0} of {1}', [filteredDoctors.value.length, doctors.value.length]),
)

function clearFilters() {
  filterStage.value = ''
  filterSource.value = ''
  filterGrain.value = ''
}

// C4: ONE selected doctor, owned here, read by BOTH the map and the panel. Local UI state — not shared,
// not persisted, not server data — so a store or composable would be the wrong home (F1/F2).
const selectedName = ref('')
const cardEls = new Map()
function registerCard(name, el) {
  if (el) cardEls.set(name, el)
  else cardEls.delete(name) // a row that leaves the list takes its ref with it
}

// Selecting is the same act from either side: the map centres on the doctor and the panel highlights the
// row. Arriving from a marker also scrolls the row into view, because a highlight you cannot see is not
// one — and the list is scrolled, never filtered: "what else is near me" is the point of this surface.
function selectDoctor(d) {
  if (!d?.name) return
  selectedName.value = d.name
  if (d.lat != null && d.lng != null) focus.value = { lat: d.lat, lng: d.lng }
  // On a phone, lift the sheet to the PEEK anchor and no further. Forcing `expanded` here was wrong: at
  // 0.85 the map is 15% of the screen, so tapping a marker buried the very map the tap came from. The
  // peek anchor shows the highlighted card with the map still more than half visible, and a reader who
  // has deliberately dragged the sheet up to browse is left where they put it — code lifts, never lowers.
  if (isNarrow.value) sheetFrac.value = Math.max(sheetFrac.value, SHEET.collapsed)
  nextTick(() => {
    const card = cardEls.get(d.name)
    card?.$el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  })
}

// C6/N-1: the lead the retired Desk page could open and this one could not. `router.resolve` BUILDS the
// URL from a named route — no interpolation, no user value in a path, nothing for a crafted `name` to
// escape into — and it opens in a new tab through this file's existing `openExternal`, so the rep does
// not lose the territory they are standing in. One new-tab mechanism in this file, not two.
function openLead(d) {
  if (!d?.name) return
  openExternal(router.resolve({ name: 'Lead', params: { leadId: d.name } }).href)
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
    (err) => {
      // Three failures, three instructions (NM-03): a GPS timeout used to read "permission denied"
      // and send the user hunting through browser settings for a permission they never revoked.
      locationDenied.value = true
      locationMessage.value =
        err?.code === 1
          ? __('Location permission denied. Enable it and retry.')
          : err?.code === 3
            ? __('Getting your location took too long. Retry.')
            : __('Your location could not be determined. Retry.')
    },
    // maximumAge 60s (NM-12): a rep reopening the page within a minute reuses the fresh fix instead of
    // paying a cold GPS lock every visit; territory search at km radii is insensitive to 60 s of drift.
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
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

async function loadDoctors({ radius = null, q = '' } = {}) {
  if (!origin.value) return
  loading.value = true
  try {
    // radius_km omitted => the server's ladder decides and reports back; passed => searched exactly.
    const args = { lat: origin.value.lat, lng: origin.value.lng }
    if (radius) args.radius_km = radius
    // TATVA: a name is not a place — with `q` the server searches the whole anchored book and ignores the ring, so a doctor 800 km away is still found. Distance still comes back, so the row says how far.
    if (q.trim()) args.q = q.trim()
    const r = await call('tatva_connect.near_me.api.doctors_in_territory', args)
    doctors.value = r?.doctors || []
    // The server says which question it answered; radiusKm keeps its ring value so clearing the box returns to it.
    scope.value = r?.scope || 'ring'
    if (scope.value === 'ring')
      radiusKm.value = Number(r?.radius_km) || radiusKm.value
    capped.value = !!r?.capped
  } catch (e) {
    // The access sentence is reserved for the server actually SAYING so (NM-02) — a 500, a timeout or
    // a network blip is "couldn't load", with the radius picker as the natural retry.
    doctors.value = []
    capped.value = false
    if (e?.exc_type === 'PermissionError') toast.error(__('You do not have access to Near Me.'))
    else toast.error(__('The list could not be loaded. Try again.'))
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
  // A row already on screen answers the query — decided BEFORE the geocode call (NM-16): the old order
  // paid Google for a result it then threw away, and read filteredDoctors after the await had gone stale.
  if (filteredDoctors.value.length) {
    areaResults.value = []
    return
  }
  try {
    const r = await call('tatva_connect.location.api.geocode_search', { query: q.trim() })
    areaResults.value = r || []
  } catch {
    areaResults.value = []
  }
}, 400)

const searchDoctors = useDebounceFn(
  (q) => loadDoctors({ radius: q.trim() ? null : radiusKm.value, q }),
  400,
)

watch(search, (q) => {
  searchArea(q)
  searchDoctors(q)
})

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
  if (useDialer.value || !callEnabled.value) {
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
  // The map config loads IN PARALLEL with the GPS fix (NM-11): it was only asked for when the map
  // mounted (v-if="origin"), so the rep granted location and then watched the map wait on a second
  // round trip it could have already made.
  useMapConfig()
  locate()
})
</script>
