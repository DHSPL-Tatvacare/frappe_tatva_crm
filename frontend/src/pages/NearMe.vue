<!--
  NearMe — first-class native page replacing the retired Near Me form-script hack. An interactive map
  fills the view; the doctor list is a rounded panel floating over it on desktop and a DRAGGABLE bottom
  sheet on mobile (peek ↔ expanded, snaps on release). A row or a pin opens the doctor inline in that
  panel; ✕ returns to the list. No page title: the sidebar and the tab already name it. One search, one
  filter, a compact radius picker, and a locate crosshair. All data is server-side: device GPS → reverse_geocode (address line) +
  doctors_in_territory (list/markers). The device reading itself is useDeviceLocation — never cached, and
  sharpened after the first paint. Desktop call reuses the CRM's telephony (globalStore.makeCall)
  when callEnabled; mobile/PWA uses the system dialer. No business logic — pure presentation.
-->
<template>
  <div class="relative flex h-full overflow-hidden">
    <!-- MAP — fills the space; the panel floats over it, a card on desktop and a sheet on mobile -->
    <div class="relative min-h-0 flex-1">
      <TatvaTerritoryMap
        v-if="origin"
        ref="mapRef"
        :here="device"
        :accuracy="accuracy"
        :origin="origin"
        :doctors="dayMode ? dayStops : filteredDoctors"
        :route="dayMode ? dayRoute : null"
        :radiusKm="dayMode || scope === 'search' ? 0 : radiusKm"
        :numbered="dayMode"
        :focus="focus"
        :selected="selectedName"
        :inset="mapInset"
        @select="openDoctor"
      >
        <!-- The hover card: the list row itself plus the shared actions, so the three never word a doctor differently. -->
        <template #peek="{ doctor }">
          <div class="w-80 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-white shadow-xl">
            <TatvaDoctorCard
              :doctor="doctor"
              :territory="listTerritory"
              :showGrain="territoryIsMixed"
              @select="openDoctor"
            />
            <TatvaDoctorActions
              class="px-4 pb-3"
              :doctor="doctor"
              @directions="onDirections"
              @call="onCall"
              @whatsapp="onWhatsapp"
              @open="openLead"
            />
          </div>
        </template>
      </TatvaTerritoryMap>
      <div
        v-else
        class="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
        :style="emptyStyle"
      >
        <FeatherIcon name="map-pin" class="h-8 w-8 text-ink-gray-4" />
        <div class="text-base text-ink-gray-6">{{ locationMessage }}</div>
        <!-- The prompt is fired by THIS tap, never by the page load: a dialog a rep never asked for is the one they swipe away, and a swiped-away dialog is not remembered — so it returned on every launch. -->
        <Button v-if="!locating" variant="solid" :label="locateLabel" @click="useMyLocation">
          <template #prefix><FeatherIcon name="crosshair" class="h-4 w-4" /></template>
        </Button>
      </div>

      <!-- LOCATE, the Maps act: centre on the dot AT ONCE, and read the device again underneath; z-10 is the sticky-inside-a-panel band — it is a SIBLING of the map, so any positive value clears the whole map subtree (bands: TatvaBottomSheet). -->
      <button
        v-if="device"
        type="button"
        :title="__('My location')"
        :aria-label="__('My location')"
        class="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-outline-gray-2 bg-surface-white text-ink-gray-7 shadow-sm hover:bg-surface-gray-2 active:bg-surface-gray-3"
        @click="useMyLocation"
      >
        <FeatherIcon
          :name="locating ? 'loader' : 'crosshair'"
          class="h-5 w-5"
          :class="{ 'animate-spin': locating }"
        />
      </button>
    </div>

    <!-- PANEL — ONE element: desktop a card floating over the map's right edge / mobile draggable bottom sheet -->
    <div
      class="absolute inset-x-0 bottom-0 z-20 flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl border-t border-outline-gray-2 bg-surface-white shadow-2xl md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-[380px] md:rounded-xl md:border"
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

      <!-- Keyed by doctor: a different doctor is a fresh detail, so no tab or page of the last one carries over. -->
      <TatvaDoctorDetail
        v-if="openedDoctor"
        :key="openedDoctor.name"
        :doctor="openedDoctor"
        :territory="listTerritory"
        :showGrain="territoryIsMixed"
        @close="closeDoctor"
        @directions="onDirections"
        @call="onCall"
        @whatsapp="onWhatsapp"
        @open="openLead"
      />
      <!-- v-show, not v-if: closing the detail returns to the list exactly where it was scrolled. -->
      <div v-show="!openedDoctor" class="flex min-h-0 flex-1 flex-col">
        <!-- Registry · My day: the lead page's own Tabs, full width — the same idiom the detail's activity tabs use. -->
        <Tabs
          v-model="modeIndex"
          :tabs="MODES"
          class="[&_[role='tab']]:flex-1 [&_[role='tab']]:justify-center [&_[role='tablist']]:gap-0 [&_[role='tablist']]:px-0 [&_[role='tabpanel']:not([hidden])]:flex [&_[role='tabpanel']:not([hidden])]:min-h-0 [&_[role='tabpanel']:not([hidden])]:flex-1"
        >
          <template #tab-panel="{ tab }">
            <TatvaMyDay
              v-if="tab.value === 'day'"
              v-model:date="planDate"
              :day="dayView"
              :loading="day.loading || (!dayView && !day.error)"
              :error="dayError"
              :selected="selectedName"
              :callable="useDialer"
              :maxStops="routeStops"
              @select="openDoctor"
              @call="onCall"
              @start="onStartRoute"
            />
            <div v-else class="flex min-h-0 flex-1 flex-col">
            <!-- Two rows: search + filter, then one quiet summary — count · radius · the neighbourhood (its full address on tap). -->
            <div class="flex shrink-0 flex-col gap-2 px-4 pb-3 pt-3">
              <div class="flex items-center gap-2">
                <FormControl
                  v-model="search"
                  class="min-w-0 flex-1"
                  type="text"
                  :placeholder="__('Search the registry or a place')"
                >
                  <template #prefix><FeatherIcon name="search" class="h-4 w-4 text-ink-gray-5" /></template>
                </FormControl>
                <Popover placement="bottom-end">
                  <template #target="{ togglePopover }">
                    <!-- The list views' own FilterIcon, icon-only until a filter is on, then with its count (Filter.vue's shape). -->
                    <Button
                      :tooltip="__('Filter')"
                      :label="activeFilters ? String(activeFilters) : __('Filter')"
                      :icon="activeFilters ? undefined : FilterIcon"
                      :iconLeft="activeFilters ? FilterIcon : undefined"
                      @click="togglePopover"
                    />
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
              </div>

              <!-- The count carries the SAME narrowing as the list (C7); a name search reaches the whole book, so it drops the radius and the place. -->
              <div v-if="origin" class="flex min-w-0 items-center gap-1 text-sm text-ink-gray-6">
                <span class="shrink-0 font-medium text-ink-gray-9">{{ __('{0} in registry', [countLabel]) }}</span>
                <template v-if="scope === 'ring'">
                  <span class="shrink-0 text-ink-gray-4">·</span>
                  <!-- The toolbar idiom BulkJobFilters uses: a ghost button with a chevron, never a form-width Select. -->
                  <Dropdown :options="radiusOptions" class="shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      :label="radiusKm ? __('{0} km', [radiusKm]) : '…'"
                      icon-right="chevron-down"
                    />
                  </Dropdown>
                  <template v-if="originArea">
                    <span class="shrink-0 text-ink-gray-4">·</span>
                    <Popover placement="bottom-start" class="min-w-0">
                      <template #target="{ togglePopover }">
                        <button
                          type="button"
                          class="block max-w-full truncate hover:text-ink-gray-8"
                          @click="togglePopover"
                        >
                          {{ __('near {0}', [originArea]) }}
                        </button>
                      </template>
                      <template #body-main>
                        <div class="flex w-64 items-start gap-2 p-3 text-sm text-ink-gray-7">
                          <FeatherIcon
                            :name="searchedArea ? 'map-pin' : 'navigation'"
                            class="mt-0.5 h-4 w-4 shrink-0 text-ink-gray-5"
                          />
                          <span>
                            {{ originAddress }}
                            <!-- A reading this loose names a street it cannot vouch for, so it says so instead of posing as an address. -->
                            <span v-if="approximate" class="text-ink-gray-5">{{ __('· approximate') }}</span>
                          </span>
                        </div>
                      </template>
                    </Popover>
                  </template>
                </template>
                <span v-else class="min-w-0 truncate">{{ __('matching “{0}”', [search.trim()]) }}</span>
              </div>
              <div v-if="capped" class="text-xs text-ink-gray-5">
                {{ __('Only the nearest {0} are shown — narrow the radius to see everything in it.', [doctors.length]) }}
              </div>

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

            <!-- rows; an empty or loading list is the native EmptyState in a full-height box (C.5), as every list in the CRM does it -->
            <div class="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
              <div v-if="loading" class="flex flex-1 items-center justify-center">
                <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
              </div>
              <!-- `origin` gates it: with no location the map area is already asking for one. -->
              <EmptyState
                v-else-if="origin && !filteredDoctors.length"
                class="flex-1"
                width="lg"
                name="Registry"
                :icon="LucideStethoscope"
                :title="emptyTitle"
                :description="emptyDescription"
              />
              <div v-else class="flex flex-col divide-y divide-outline-gray-1 border-t border-outline-gray-1">
                <TatvaDoctorCard
                  v-for="d in filteredDoctors"
                  :key="d.name"
                  :ref="(el) => registerCard(d.name, el)"
                  :doctor="d"
                  :territory="territory"
                  :selected="d.name === selectedName"
                  :showGrain="territoryIsMixed"
                  :callable="useDialer"
                  @select="openDoctor"
                  @call="onCall"
                />
              </div>
            </div>
            </div>
          </template>
        </Tabs>
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
import TatvaTerritoryMap from '@/tatva/TatvaTerritoryMap.vue'
import TatvaDoctorCard from '@/tatva/TatvaDoctorCard.vue'
import TatvaDoctorDetail from '@/tatva/TatvaDoctorDetail.vue'
import TatvaDoctorActions from '@/tatva/TatvaDoctorActions.vue'
import TatvaMyDay from '@/tatva/TatvaMyDay.vue'
import { doctorStage, routeUrl, whatsappUrl } from '@/tatva/doctorMeta'
import { callEnabled } from '@/composables/telephony'
import { globalStore } from '@/stores/global'
import { Button, Dropdown, FeatherIcon, FormControl, Popover, Tabs, call, createResource, dayjs, toast, usePageMeta } from 'frappe-ui'
import { getSettings } from '@/stores/settings'
import { computed, markRaw, ref, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { useSheetDrag } from '@/composables/useSheetDrag'
import { isMobileView, isStandalonePWA } from '@/composables/settings'
import { useMapConfig } from '@/composables/mapConfig'
import {
  useDeviceLocation,
  locationPermission,
  blockedMessage,
  metresBetween,
  COARSE_M,
} from '@/composables/useDeviceLocation'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import FilterIcon from '@/components/Icons/FilterIcon.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import LucideStethoscope from '~icons/lucide/stethoscope'
import LucideRoute from '~icons/lucide/route'

// TATVA: the browser tab names the page, as its header does.
const { brand } = getSettings()
usePageMeta(() => ({ title: __('Near Me'), icon: brand.favicon }))

const { makeCall } = globalStore()
const router = useRouter()

const mapRef = ref(null)
// `device` is where the rep physically is (the pulsing dot); `origin` is the point being searched
// around. They are the same until an area is searched, and the crosshair puts them back together.
const device = ref(null)
const origin = ref(null)
const originAddress = ref('')
// The neighbourhood the server names the origin by ("HSR Layout") — the header's short form; the full address sits behind it.
const originArea = ref('')
const searchedArea = ref(false)
const doctors = ref([])
// The reply as linkTitle.js reads a list ({ data: { _link_titles } }), so a stage shows its title through the one reader.
const territory = ref(null)
const loading = ref(false)
// Reading the device, and sharpening it, is the composable's job; this page owns only what it does next.
const {
  coords: fix,
  accuracy,
  status: locStatus,
  message: locMessage,
  locate: readDevice,
} = useDeviceLocation()
const locating = computed(() => locStatus.value === 'locating')
// Read once on open: 'granted' locates with no prompt, 'denied' is said up front instead of after a tap.
const permission = ref('unknown')
const locationMessage = computed(() => {
  if (locMessage.value) return locMessage.value
  if (permission.value === 'denied') return blockedMessage()
  return __('See the registry around you.')
})
const locateLabel = computed(() =>
  locStatus.value === 'error' ? __('Try again') : __('Use my location'),
)
// Looser than COARSE_M is an AREA, not a point: the map draws the halo, the address line says so.
const approximate = computed(() => !searchedArea.value && accuracy.value > COARSE_M)

// Null until the server answers: on first load IT picks the radius, walking outwards until it finds
// doctors, so the page cannot open on an empty list merely because a number in the client was too
// small. Once the user picks from the dropdown, that choice is sent and honoured exactly.
const radiusKm = ref(null)
const RADII_KM = [5, 10, 15, 30, 60, 120]
const radiusOptions = RADII_KM.map((km) => ({
  label: `${km} km`,
  onClick: () => {
    radiusKm.value = km
    loadDoctors({ radius: km })
  },
}))

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
const { sheetStyle, onDragStart, onDragMove, onDragEnd, sheetFrac, sheetHeight, isNarrow } =
  useSheetDrag(SHEET)
// With no location yet the sheet still covers the bottom of the phone, so the invitation is centred in
// what the rep can actually see — measured off the sheet's own fraction, and it follows a drag.
const emptyStyle = computed(() =>
  isNarrow.value ? { paddingBottom: `calc(${sheetFrac.value} * 100dvh)` } : null,
)

// ---- filters / search ---------------------------------------------------------------------
// The value is the key the rows filter on; the label is what the rep reads (a stage's title, never its `::` key).
function distinct(field, labelOf = (d) => d[field]) {
  const seen = new Map()
  for (const d of doctors.value) {
    if (d[field] && !seen.has(d[field])) seen.set(d[field], labelOf(d))
  }
  const opts = [...seen].map(([value, label]) => ({ label, value }))
  opts.sort((a, b) => a.label.localeCompare(b.label))
  return [{ label: __('All'), value: '' }, ...opts]
}
const stageOptions = computed(() => distinct('stage', (d) => doctorStage(d, territory.value)))
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

// The empty list says what was searched — a name across the whole book, or the ring the server actually used.
const emptyTitle = computed(() =>
  scope.value === 'search'
    ? __('Nothing in the registry matches “{0}”', [search.value.trim()])
    : __('Nothing in the registry within {0} km', [radiusKm.value]),
)
const emptyDescription = computed(() =>
  activeFilters.value
    ? __('Clear the filters to see everyone here.')
    : scope.value === 'search'
      ? __('Only entries with a clinic location are listed.')
      : __('Widen the radius to look further out.'),
)

const activeFilters = computed(
  () => [filterStage.value, filterSource.value, filterGrain.value].filter(Boolean).length,
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

// ---- My day --------------------------------------------------------------------------------
const MODES = [
  { label: __('Registry'), value: 'registry', icon: markRaw(LucideStethoscope) },
  { label: __('My day'), value: 'day', icon: markRaw(LucideRoute) },
]
const modeIndex = ref(0)
const dayMode = computed(() => MODES[modeIndex.value].value === 'day')

// One day's plan from where the rep stands: asked when the tab opens or the day changes, and again only once the rep has
// genuinely moved (C.3). The server remembers the order per day, so a re-ask never reshuffles it or pays Google twice.
const planDate = ref(dayjs().format('YYYY-MM-DD'))
const dayOrigin = ref(null)
const day = createResource({
  url: 'tatva_connect.near_me.api.my_day',
  makeParams: () => ({ lat: dayOrigin.value.lat, lng: dayOrigin.value.lng, date: planDate.value }),
})
function loadDay() {
  if (!dayMode.value || !device.value) return
  const same = day.data?.date === planDate.value && metresBetween(dayOrigin.value, device.value) < MOVED_M
  if (same) return
  dayOrigin.value = { ...device.value }
  day.reload()
}
watch([dayMode, planDate], loadDay)
// Only the reply for the day on screen is drawn, so a late answer for a day the rep has left never shows.
const dayView = computed(() => (day.data?.date === planDate.value ? day.data : null))
const dayError = computed(() =>
  day.error ? day.error.messages?.[0] || __('Try again in a moment.') : '',
)
const dayStops = computed(() => dayView.value?.stops || [])
// The line the map draws: Google's road path when it ordered the day, else straight between the stops (from here, today).
const dayRoute = computed(() => {
  const d = dayView.value
  if (!d?.stops?.length) return null
  if (d.polyline) return { encoded: d.polyline }
  const points = d.stops.map((s) => ({ lat: s.lat, lng: s.lng }))
  return { points: d.is_today && dayOrigin.value ? [dayOrigin.value, ...points] : points }
})

// The rows on screen read their stage titles off the reply that sent them.
const listTerritory = computed(() =>
  dayMode.value ? (dayView.value ? { data: dayView.value } : null) : territory.value,
)

// Google Maps URLs carry 3 waypoints on a mobile browser and 9 elsewhere, plus the destination.
const routeStops = computed(() => (useDialer.value ? 4 : 10))
function onStartRoute(stops) {
  if (device.value && stops.length) openExternal(routeUrl(device.value, stops))
}

// The doctor open in the panel. Held until ✕, so a re-query underneath never yanks the detail away mid-read.
const openedDoctor = ref(null)
function openDoctor(d) {
  if (!d?.name) return
  selectDoctor(d)
  openedDoctor.value = d
}
function closeDoctor() {
  openedDoctor.value = null
}

// C6/N-1: the lead the retired Desk page could open and this one could not. `router.resolve` BUILDS the
// URL from a named route — no interpolation, no user value in a path, nothing for a crafted `name` to
// escape into — and it opens in a new tab through this file's existing `openExternal`, so the rep does
// not lose the territory they are standing in. One new-tab mechanism in this file, not two.
function openLead(d) {
  if (!d?.name) return
  openExternal(router.resolve({ name: 'Lead', params: { leadId: d.name } }).href)
}

// ---- where the rep is ---------------------------------------------------------------------
// The point the list and the ring were last asked about, so a sharpened reading re-asks only if it moved.
let queriedAt = null
const MOVED_M = 150
// True during a read's own first paint — without it the settle watcher below asks the server the same thing.
let firstPaint = false

// The Maps act, and both buttons do it: read the device AGAIN, move the dot, then centre. It used to only slide the map back to the reading taken when the page opened, so a rep who had driven since was returned to where they no longer were.
async function useMyLocation() {
  // Centre on the dot we already have FIRST: a tap has to answer immediately, not after a GPS lock.
  mapRef.value?.recenter?.()
  firstPaint = true
  try {
    searchedArea.value = false
    const first = await readDevice()
    if (!first) {
      // The empty state is only on screen before the first read — after that a failure has nowhere to show.
      if (origin.value) toast.error(locMessage.value)
      return
    }
    device.value = { ...first }
    origin.value = { ...first }
    queriedAt = { ...first }
    reverseGeocode()
    loadDay()
    // radiusKm is null until the rep picks one and loadDoctors drops a falsy radius: first read gets the server's ladder, later reads honour the chosen ring.
    loadDoctors({ radius: radiusKm.value })
    // Only meaningful once a map exists; on the first read it is being built around this very origin.
    nextTick(() => mapRef.value?.recenter?.())
  } finally {
    firstPaint = false
  }
}

// The dot follows the reading as it sharpens; the VIEW does not, because a map that re-frames itself under a rep's thumb cannot be read.
watch(fix, (next) => {
  if (next) device.value = { ...next }
})

// Settled: the ring and the list follow a sharper reading only if it genuinely moved the search, never on a metre of drift.
watch(locStatus, (s) => {
  if (s !== 'ready' || firstPaint || searchedArea.value || !fix.value) return
  if (metresBetween(queriedAt, fix.value) < MOVED_M) return
  origin.value = { ...fix.value }
  queriedAt = { ...fix.value }
  reverseGeocode()
  loadDoctors({ radius: radiusKm.value })
  loadDay()
})

async function reverseGeocode() {
  try {
    const r = await call('tatva_connect.location.api.reverse_geocode', {
      lat: origin.value.lat,
      lng: origin.value.lng,
    })
    originAddress.value = (r && r.address) || ''
    originArea.value = (r && r.area) || ''
  } catch {
    originAddress.value = ''
    originArea.value = ''
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
    territory.value = { data: r }
    // The server says which question it answered; radiusKm keeps its ring value so clearing the box returns to it.
    scope.value = r?.scope || 'ring'
    if (scope.value === 'ring')
      radiusKm.value = Number(r?.radius_km) || radiusKm.value
    capped.value = !!r?.capped
  } catch (e) {
    // The access sentence is reserved for the server actually SAYING so (NM-02) — a 500, a timeout or
    // a network blip is "couldn't load", with the radius picker as the natural retry.
    doctors.value = []
    territory.value = null
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

// Places are offered only when no doctor matched — asked AFTER the doctor search answers, so the decision reads this query's rows, not the last one's.
async function searchArea(q) {
  if (q.trim().length < 3 || doctors.value.length) {
    areaResults.value = []
    return
  }
  try {
    const r = await call('tatva_connect.location.api.geocode_search', { query: q.trim() })
    // A newer query superseded this one while Google answered.
    if (search.value === q) areaResults.value = r || []
  } catch {
    areaResults.value = []
  }
}

const searchDoctors = useDebounceFn(async (q) => {
  await loadDoctors({ radius: q.trim() ? null : radiusKm.value, q })
  if (search.value === q) searchArea(q)
}, 400)

watch(search, searchDoctors)

function goToArea(place) {
  searchedArea.value = true
  origin.value = { lat: place.lat, lng: place.lng }
  originAddress.value = place.address
  originArea.value = place.area || ''
  areaResults.value = []
  // Clearing the box is the reload: the search watcher re-asks for the ring around the new origin, once.
  search.value = ''
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

// What the panel hides of the map: the sheet's live height on a phone, the card's right edge on desktop (md:w-[380px] + md:right-3).
const DESKTOP_PANEL_PX = 392
const mapInset = computed(() => ({
  top: 0,
  left: 0,
  right: isNarrow.value ? 0 : DESKTOP_PANEL_PX,
  bottom: sheetHeight.value,
}))

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
// The rep's own WhatsApp app, opened on the doctor's chat — the same anchor-click as directions.
function onWhatsapp(d) {
  const url = whatsappUrl(d)
  if (url) openExternal(url)
}
function onDirections(d) {
  if (d.lat == null || d.lng == null) return
  openExternal(`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`)
}

onMounted(async () => {
  // The map config is asked for immediately (NM-11): it used to wait for the map to mount (v-if="origin"),
  // so the rep granted location and then watched the map pay a second round trip it could already have made.
  useMapConfig()
  // Already granted => read on open, nothing prompts, nothing changes for a set-up rep. Otherwise the page opens on a button, because a prompt fired by a page load is the one that gets swiped away — and a swipe is never remembered, which is why it returned on every launch.
  permission.value = await locationPermission()
  if (permission.value === 'granted') useMyLocation()
})
</script>
