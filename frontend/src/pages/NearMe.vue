<!--
  NearMe — the page: a full-height map with one panel floating over it (a card on desktop, a draggable sheet on
  mobile). It owns layout and wiring only — where the rep is, which doctor is selected, the call dialog and the
  links out. The registry lives in tatva/nearme/useRegistry (its tab is RegistryPanel), the day plan in
  tatva/nearme/useMyDay (its tab is MyDay); every piece of Near Me sits in tatva/nearme/.
-->
<template>
  <div class="relative flex h-full overflow-hidden">
    <!-- MAP — fills the space; the panel floats over it, a card on desktop and a sheet on mobile -->
    <div class="relative min-h-0 flex-1">
      <TerritoryMap
        v-if="origin"
        ref="mapRef"
        :here="device"
        :accuracy="accuracy"
        :origin="origin"
        :doctors="dayMode ? dayStops : filteredDoctors"
        :route="dayMode ? dayRoute : null"
        :numbered="dayMode"
        :focus="focus"
        :selected="selectedName"
        :inset="mapInset"
        @select="openDoctor"
      >
        <!-- The hover card: the list row itself plus the shared actions, so the three never word a doctor differently. -->
        <template #peek="{ doctor }">
          <div
            class="w-80 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-white shadow-xl"
          >
            <DoctorRow
              :doctor="doctor"
              :territory="listTerritory"
              :showGrain="territoryIsMixed"
              @select="openDoctor"
            />
            <DoctorActions
              class="px-4 pb-3"
              :doctor="doctor"
              @directions="onDirections"
              @call="onCall"
              @whatsapp="onWhatsapp"
              @open="openLead"
            />
          </div>
        </template>
      </TerritoryMap>
      <div
        v-else
        class="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
        :style="emptyStyle"
      >
        <FeatherIcon name="map-pin" class="h-8 w-8 text-ink-gray-4" />
        <div class="text-base text-ink-gray-6">{{ locationMessage }}</div>
        <!-- The prompt is fired by THIS tap, never by the page load: a dialog a rep never asked for is the one they swipe away, and a swiped-away dialog is not remembered — so it returned on every launch. -->
        <Button
          v-if="!locating"
          variant="solid"
          :label="locateLabel"
          @click="useMyLocation"
        >
          <template #prefix
            ><FeatherIcon name="crosshair" class="h-4 w-4"
          /></template>
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
      :ref="bindSheet"
      data-sheet-grab
    >
      <!-- The whole panel is the grab area on a phone; its lists (data-sheet-scroll) pull it down only from their top. -->
      <div class="flex shrink-0 cursor-grab justify-center py-2 md:hidden">
        <div class="h-1.5 w-10 rounded-full bg-surface-gray-4" />
      </div>

      <!-- Keyed by doctor: a different doctor is a fresh detail, so no tab or page of the last one carries over. -->
      <DoctorDetail
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
            <MyDay
              v-if="tab.value === 'day'"
              v-model:date="planDate"
              v-model:rep="rep"
              :team="team.data || []"
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
            <RegistryPanel
              v-else
              ref="panelRef"
              :selected="selectedName"
              :callable="useDialer"
              :approximate="approximate"
              @select="openDoctor"
              @call="onCall"
            />
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
        <Button
          variant="solid"
          :label="__('Call via telephony')"
          @click="callViaTelephony"
        />
        <Button :label="__('Open phone dialer')" @click="callViaDialer" />
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import TerritoryMap from '@/tatva/nearme/TerritoryMap.vue'
import DoctorRow from '@/tatva/nearme/DoctorRow.vue'
import DoctorDetail from '@/tatva/nearme/DoctorDetail.vue'
import DoctorActions from '@/tatva/nearme/DoctorActions.vue'
import MyDay from '@/tatva/nearme/MyDay.vue'
import RegistryPanel from '@/tatva/nearme/RegistryPanel.vue'
import { routeUrl, whatsappUrl } from '@/tatva/nearme/doctorMeta'
import { REGISTRY, useRegistry } from '@/tatva/nearme/useRegistry'
import { useMyDay } from '@/tatva/nearme/useMyDay'
import { callEnabled } from '@/composables/telephony'
import { globalStore } from '@/stores/global'
import { Button, FeatherIcon, Tabs, call, toast, usePageMeta } from 'frappe-ui'
import { getSettings } from '@/stores/settings'
import {
  computed,
  markRaw,
  provide,
  ref,
  watch,
  onMounted,
  nextTick,
} from 'vue'
import { useRouter } from 'vue-router'
import { useSheetDrag } from '@/composables/useSheetDrag'
import { isMobileView, isStandalonePWA } from '@/composables/settings'
import { useMapConfig } from '@/composables/mapConfig'
import {
  useDeviceLocation,
  locationPermission,
  blockedMessage,
  metresBetween,
  COARSE_M,
  MOVED_M,
} from '@/composables/useDeviceLocation'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
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
const approximate = computed(
  () => !searchedArea.value && accuracy.value > COARSE_M,
)

const focus = ref(null)

// The registry (Registry tab, and the map's pins there): one per page, provided to its panel.
const registry = useRegistry({
  origin,
  originAddress,
  originArea,
  searchedArea,
})
provide(REGISTRY, registry)
const { filteredDoctors, territory, territoryIsMixed, radiusKm, loadDoctors } =
  registry

// One mobile brain (NM-10): a phone-sized viewport or an installed PWA uses the system dialer. The
// page-local `pointer: coarse` copy this replaces sent every touchscreen LAPTOP to the dialer too.
const useDialer = computed(() => isMobileView.value || isStandalonePWA)

// ---- draggable bottom sheet (mobile only) — the shared engine (drag + snap + body scroll lock) ----
// Named once, because selecting a doctor has to be able to REVEAL the row it highlighted: on a phone the
// panel may be at peek height, and a highlight hidden behind the sheet edge is not a highlight.
const SHEET = { collapsed: 0.42, expanded: 0.85, min: 0.16 }
const { sheetStyle, bindSheet, snapTo, sheetFrac, sheetHeight, isNarrow } =
  useSheetDrag(SHEET)
// With no location yet the sheet still covers the bottom of the phone, so the invitation is centred in
// what the rep can actually see — measured off the sheet's own fraction, and it follows a drag.
const emptyStyle = computed(() =>
  isNarrow.value
    ? { paddingBottom: `calc(${sheetFrac.value} * 100dvh)` }
    : null,
)

// C4: ONE selected doctor, owned here, read by BOTH the map and the panel. Local UI state — not shared,
// not persisted, not server data — so a store or composable would be the wrong home (F1/F2).
const selectedName = ref('')
const panelRef = ref(null)

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
  if (isNarrow.value && sheetFrac.value < SHEET.collapsed)
    snapTo(SHEET.collapsed)
  panelRef.value?.reveal(d.name)
}

// ---- My day --------------------------------------------------------------------------------
const MODES = [
  {
    label: __('Registry'),
    value: 'registry',
    icon: markRaw(LucideStethoscope),
  },
  { label: __('My day'), value: 'day', icon: markRaw(LucideRoute) },
]
const modeIndex = ref(0)
const dayMode = computed(() => MODES[modeIndex.value].value === 'day')

const {
  planDate,
  rep,
  team,
  day,
  loadDay,
  dayView,
  dayError,
  dayStops,
  dayRoute,
} = useMyDay({
  device,
  active: dayMode,
})

// The rows on screen read their stage titles off the reply that sent them.
const listTerritory = computed(() =>
  dayMode.value
    ? dayView.value
      ? { data: dayView.value }
      : null
    : territory.value,
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
  openExternal(
    router.resolve({ name: 'Lead', params: { leadId: d.name } }).href,
  )
}

// ---- where the rep is ---------------------------------------------------------------------
// The point the list and the ring were last asked about, so a sharpened reading re-asks only if it moved.
let queriedAt = null
// True during a read's own first paint — without it the settle watcher below asks the server the same thing.
let firstPaint = false

// The Maps act, and both buttons do it: read the device AGAIN, move the dot, then centre. It used to only slide the map back to the reading taken when the page opened, so a rep who had driven since was returned to where they no longer were.
async function useMyLocation() {
  // Centre on the dot we already have FIRST: a tap has to answer immediately, not after a GPS lock.
  mapRef.value?.recenter?.()
  firstPaint = true
  try {
    const wasSearched = searchedArea.value
    searchedArea.value = false
    const first = await readDevice()
    if (!first) {
      // The empty state is only on screen before the first read — after that a failure has nowhere to show.
      if (origin.value) toast.error(locMessage.value)
      return
    }
    device.value = { ...first }
    // The settle watcher's own rule: under MOVED_M from the last ask, and not returning from a searched area, the answer is the one on screen.
    if (!wasSearched && metresBetween(queriedAt, first) < MOVED_M) {
      nextTick(() => mapRef.value?.recenter?.())
      return
    }
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
  if (callTarget.value?.mobile_no)
    window.location.href = 'tel:' + callTarget.value.mobile_no
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
  openExternal(
    `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`,
  )
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
