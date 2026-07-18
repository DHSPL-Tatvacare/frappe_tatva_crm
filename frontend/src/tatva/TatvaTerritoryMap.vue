<!--
  TatvaTerritoryMap — the interactive Near Me map: a "you are here" dot, the search-radius ring, and the
  doctor markers, clustered into counts that split as you zoom.

  ONE provider: Google. The Maps JavaScript API is the only thing here that must run in the browser, so
  it takes the referrer-restricted BROWSER key (map_config().browser_key — never the server key). There
  is no second implementation to drift against: the previous Leaflet branch, its markercluster, and a
  hand-written OverlayView "you" dot all went, and with them the operator Select that pretended you could
  choose. No key => no map, said plainly, instead of a silently different one. (The task mini-maps are a
  different surface and keep their OSM/Google choice — see TatvaMiniMap.)

  Clustering is @googlemaps/markerclusterer — Google's own library, constructed ONCE and fed markers;
  nothing about clusters is hand-rolled here. Markers are AdvancedMarkerElement (google.maps.Marker is
  deprecated), which also gives us the "you" dot as plain DOM + the same CSS the app already ships.

  Lazy by construction: the API script is requested on mount of THIS page only, and only when a key
  exists. Pure presentation — every datum is a prop; clicking a marker emits `select`, a `focus` prop
  pan-zooms, `recenter()` is exposed for the page's crosshair.
-->
<template>
  <div class="relative h-full w-full">
    <div ref="el" class="h-full w-full bg-surface-gray-2" />
    <!-- Shown only for a settled failure — a genuinely blank key, or Google failing to load. A config
         that simply hasn't arrived yet is NOT a failure, so the overlay never covers a map still loading. -->
    <div
      v-if="unavailable || loadError"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-gray-2 p-6 text-center"
    >
      <FeatherIcon name="map" class="h-8 w-8 text-ink-gray-4" />
      <div class="text-base text-ink-gray-6">
        {{ unavailable ? __('The map is not configured.') : __('The map could not be loaded.') }}
      </div>
      <div class="text-sm text-ink-gray-5">
        {{
          unavailable
            ? __('Ask an administrator to set the Google Maps browser key in CRM Maps Settings.')
            : __('Check that the browser key allows this site (its HTTP referrer restrictions).')
        }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref, computed } from 'vue'
import { FeatherIcon } from 'frappe-ui'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { useMapConfig } from '@/composables/mapConfig'

const props = defineProps({
  here: { type: Object, default: null }, // { lat, lng } — where the rep IS (the pulsing dot)
  origin: { type: Object, default: null }, // { lat, lng } — what is being SEARCHED around (ring + fit)
  doctors: { type: Array, default: () => [] },
  radiusKm: { type: [Number, String], default: 0 },
  focus: { type: Object, default: null }, // { lat, lng } — pan-zoom target
})

const emit = defineEmits(['select'])

const el = ref(null)
const BLUE = '#2563eb'
const RED = '#dc2626'

const mapConfig = useMapConfig()

// "Not configured" is a SETTLED verdict, never a guess made mid-load: it is true only once the config
// has actually arrived (non-null) AND its browser key is genuinely blank. A null config means "still
// fetching" — treating that as unavailable is what latched the overlay over a working map when the
// device fix landed before the config did.
const unavailable = computed(() => mapConfig.value != null && !mapConfig.value.browser_key)
// A distinct, recoverable failure: Google's script itself failed to load (bad referrer, network). Reset
// on every attempt so a later success clears it — never a one-way latch.
const loadError = ref(false)

let map = null
let clusterer = null
let markers = []
let hereMarker = null
let ring = null
let initPromise = null // one shared init: concurrent refreshes await the same build, never race a second map

const radiusM = () => (Number(props.radiusKm) || 0) * 1000

// Google's prescribed include for the Maps JS API — the one script that legitimately needs the key in
// the browser. De-duped by src, so a remount never loads it twice.
function loadMapsApi(key) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.marker?.AdvancedMarkerElement) return resolve()
    const src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=marker&loading=async&v=weekly`
    const existing = document.querySelector(`script[src="${src}"]`)
    const done = () => (window.google?.maps ? resolve() : reject(new Error('maps api missing')))
    if (existing) {
      existing.addEventListener('load', done)
      existing.addEventListener('error', () => reject(new Error('maps api failed')))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.addEventListener('load', done)
    s.addEventListener('error', () => reject(new Error('maps api failed')))
    document.head.appendChild(s)
  })
}

// The "you are here" dot and each doctor pin are plain DOM handed to an AdvancedMarkerElement, so both
// reuse the CSS this app already ships — no OverlayView subclass, no second styling source.
function hereContent() {
  const d = document.createElement('div')
  d.className = 'tatva-here'
  d.innerHTML =
    `<div class="tatva-here-pulse" style="background:${BLUE}"></div>` +
    `<div class="tatva-here-dot" style="background:${BLUE}"></div>`
  return d
}

function doctorContent() {
  const d = document.createElement('div')
  d.className = 'tatva-doctor-pin'
  d.style.background = RED
  return d
}

function ensureMap() {
  if (map) return Promise.resolve()
  const key = mapConfig.value?.browser_key
  if (!key || !el.value) return Promise.resolve() // still loading / no key: the computed shows the notice
  // Serialize: the first caller builds, everyone else awaits that same build. On failure the promise is
  // cleared so a later refresh can retry rather than re-throwing a dead one forever.
  if (!initPromise) {
    initPromise = (async () => {
      await loadMapsApi(key)
      const g = window.google.maps
      const c = props.origin || props.here || props.doctors[0] || { lat: 0, lng: 0 }
      map = new g.Map(el.value, {
        center: { lat: c.lat, lng: c.lng },
        zoom: 12,
        mapId: mapConfig.value.map_id, // AdvancedMarkerElement needs a Map ID; operator-set, server-defaulted
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      clusterer = new MarkerClusterer({ map }) // constructed ONCE — markers are added/cleared, never re-newed
    })().catch((e) => {
      initPromise = null
      throw e
    })
  }
  return initPromise
}

// `fit` reframes the view (device location or radius changed); a data-only change redraws markers and
// leaves the user's current pan/zoom exactly where they left it.
function draw(fit) {
  if (!map) return
  const g = window.google.maps

  // The dot follows the rep; the ring follows what is being searched. After an area search those are
  // two different places, and drawing the rep's dot around a Dubai search would be a lie.
  if (props.here) {
    if (!hereMarker) {
      hereMarker = new g.marker.AdvancedMarkerElement({ map, content: hereContent(), zIndex: 1000 })
    }
    hereMarker.position = props.here
  }
  const centre = props.origin || props.here
  if (fit && centre) {
    if (!ring) {
      ring = new g.Circle({ strokeColor: BLUE, strokeWeight: 1, fillColor: BLUE, fillOpacity: 0.08 })
    }
    ring.setOptions({ map, center: centre, radius: radiusM() })
  }

  clusterer.clearMarkers()
  markers = props.doctors
    .filter((d) => d.lat != null && d.lng != null)
    .map((d) => {
      const m = new g.marker.AdvancedMarkerElement({
        position: { lat: d.lat, lng: d.lng },
        content: doctorContent(),
      })
      m.addListener('click', () => emit('select', d))
      return m
    })
  clusterer.addMarkers(markers)

  if (!fit) return
  // Frame the search ring (a known geometry, so the first paint never waits on markers), then widen to
  // the doctors if any sit outside it — a result set you cannot see is the same as no result set.
  const bounds = new g.LatLngBounds()
  if (ring) bounds.union(ring.getBounds())
  markers.forEach((m) => bounds.extend(m.position))
  if (!bounds.isEmpty()) map.fitBounds(bounds, 24)
}

function destroy() {
  if (clusterer) {
    clusterer.clearMarkers()
    clusterer.setMap(null)
    clusterer = null
  }
  markers.forEach((m) => (m.map = null))
  markers = []
  if (hereMarker) hereMarker.map = null
  hereMarker = null
  if (ring) ring.setMap(null)
  ring = null
  map = null
  initPromise = null // a remount rebuilds from scratch rather than awaiting the old, dead build
}

async function refresh(fit) {
  try {
    loadError.value = false // clear last attempt's failure; a success below leaves it clear
    await ensureMap()
    draw(fit)
  } catch {
    loadError.value = true // Google's script failed to load — show the notice, never a faked map
  }
}

// The config arrives async (one shared fetch); the map is built the moment it lands, and once only.
watch(mapConfig, () => refresh(true), { immediate: false })
onMounted(() => mapConfig.value && refresh(true))

// The searched point, the rep's position, or the radius changed → redraw + reframe.
watch(() => [props.origin, props.here, props.radiusKm], () => refresh(true))
// List changed (filter / re-query) → markers only; the user's pan and zoom are left alone.
watch(() => props.doctors, () => refresh(false))
// A card was tapped → centre on it.
watch(
  () => props.focus,
  (f) => {
    if (!map || !f || f.lat == null || f.lng == null) return
    map.panTo({ lat: f.lat, lng: f.lng })
    map.setZoom(16)
  },
)

// Recenter on the rep's own location (the crosshair control in the page).
function recenter() {
  if (!map || !props.here) return
  map.panTo(props.here)
  map.setZoom(14)
}
defineExpose({ recenter })

onBeforeUnmount(destroy)
</script>

<!-- NOT scoped: AdvancedMarkerElement content is rendered outside this component's scoped DOM. Class
     names are namespaced (tatva-*) so this is collision-safe. Colours are inlined from the JS consts. -->
<style>
.tatva-here {
  position: relative;
  width: 22px;
  height: 22px;
}
.tatva-doctor-pin {
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 9999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.tatva-here-dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  border: 2.5px solid #fff;
  border-radius: 9999px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.tatva-here-pulse {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
  opacity: 0.35;
  animation: tatva-here-pulse 2s ease-out infinite;
}
@keyframes tatva-here-pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.35;
  }
  70% {
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) scale(3.4);
    opacity: 0;
  }
}
</style>
