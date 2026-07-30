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
    <!-- Shown only for a settled failure — a genuinely blank key, Google failing to load, or the config
         fetch itself failing (NM-01: three distinct verdicts). A config that simply hasn't arrived yet is
         NOT a failure, so the overlay never covers a map still loading. -->
    <!-- Wording, icon and the Retry rule live in TatvaMapUnavailable, so no two maps apologise differently. -->
    <TatvaMapUnavailable
      v-if="failure"
      :reason="failure"
      class="absolute inset-0"
      @retry="retry"
    />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref, computed } from 'vue'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import TatvaMapUnavailable from '@/tatva/TatvaMapUnavailable.vue'
import { useMapConfig, mapConfigError, retryMapConfig } from '@/composables/mapConfig'
import { cssToken } from '@/utils'

const props = defineProps({
  here: { type: Object, default: null }, // { lat, lng } — where the rep IS (the pulsing dot)
  origin: { type: Object, default: null }, // { lat, lng } — what is being SEARCHED around (ring + fit)
  doctors: { type: Array, default: () => [] },
  radiusKm: { type: [Number, String], default: 0 },
  focus: { type: Object, default: null }, // { lat, lng } — pan-zoom target
  selected: { type: String, default: '' }, // the doctor `name` currently selected in the panel (C4)
})

// Selection is the ONLY thing a marker reports (C4): a tap on the map highlights that doctor in the
// panel. Opening the lead is a deliberate action and belongs on the card, not on a 14px dot.
const emit = defineEmits(['select'])

const el = ref(null)

const mapConfig = useMapConfig()

// "Not configured" is a SETTLED verdict, never a guess made mid-load: it is true only once the config
// has actually arrived (non-null) AND its browser key is genuinely blank. A null config means "still
// fetching" — treating that as unavailable is what latched the overlay over a working map when the
// device fix landed before the config did.
const unavailable = computed(() => mapConfig.value != null && !mapConfig.value.browser_key)
// The third settled verdict (NM-01): the config FETCH failed — without it a null config read as
// still-loading and the outage rendered as a bare grey box with no message and no way out.
const configFailed = computed(() => mapConfigError.value && !mapConfig.value)
// A distinct, recoverable failure: Google's script itself failed to load (bad referrer, network). Reset
// on every attempt so a later success clears it — never a one-way latch.
const loadError = ref(false)
// Which of the three, in the precedence the messages already had. Null means there is nothing to say.
const failure = computed(() =>
  configFailed.value
    ? 'config'
    : unavailable.value
      ? 'unconfigured'
      : loadError.value
        ? 'load'
        : null,
)

let map = null
let clusterer = null
let markers = []
let hereMarker = null
let ring = null
let initPromise = null // one shared init: concurrent refreshes await the same build, never race a second map

const radiusM = () => (Number(props.radiusKm) || 0) * 1000

// Google's Circle takes a colour STRING, not a class, so the value is read — through the app's ONE token
// reader (`utils.cssToken`), shared with TatvaMiniMap. Everything drawn in CSS uses `var(--…)` directly.

// THE MAPS API IS READY WHEN GOOGLE SAYS SO, AND GOOGLE SAYS SO EXACTLY ONE WAY: the `callback`
// parameter on the include. Nothing else on this form of the script is a readiness signal —
// measured cold on 2026-07-30, at the moment the script's `load` event fires:
//     google.maps.Map          -> "is not a constructor"
//     google.maps.importLibrary -> "is not a function"
//     google.maps.marker        -> undefined
// The bootstrap stub has merely parsed; the API and everything in `libraries=` arrive afterwards. So
// waiting on `load` handed `ensureMap` a hollow namespace, `new g.Map(...)` threw, `refresh` latched
// `loadError`, and — because no prop changes after the first paint — the map stayed dead behind "the
// map could not be loaded" while the key, the referrer and the tiles were all perfectly fine. Warm
// reloads won the race by luck, which is why the failure looked intermittent for months.
//
// The promise is module-level, so it is also the de-dupe: the first surface to need a map loads the
// script, every later one awaits the same promise, and a remount never adds a second tag. On failure it
// is cleared, so Retry genuinely re-attempts instead of re-throwing a dead promise.
const MAPS_READY_CALLBACK = '__tatvaMapsApiReady'
let mapsApiPromise = null

function loadMapsApi(key) {
  if (window.google?.maps?.marker?.AdvancedMarkerElement) return Promise.resolve()
  if (mapsApiPromise) return mapsApiPromise
  mapsApiPromise = new Promise((resolve, reject) => {
    window[MAPS_READY_CALLBACK] = resolve
    const s = document.createElement('script')
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&libraries=marker&loading=async&v=weekly&callback=${MAPS_READY_CALLBACK}`
    s.async = true
    s.addEventListener('error', () => reject(new Error('maps api failed to load')))
    document.head.appendChild(s)
  }).catch((e) => {
    mapsApiPromise = null
    throw e
  })
  return mapsApiPromise
}

// The "you are here" dot and each doctor pin are plain DOM handed to an AdvancedMarkerElement, so both
// reuse the CSS this app already ships — no OverlayView subclass, no second styling source.
//
// C1: NO COLOUR IS SPELLED HERE. It used to be two hex literals (#2563eb / #dc2626) which are Tailwind's
// defaults, not this app's palette (blue is #0289F7, red is #E03636) — and the same two literals were
// copied into TatvaMiniMap. Colour lives in the <style> block, as design tokens, once.
function hereContent() {
  const d = document.createElement('div')
  d.className = 'tatva-here'
  d.innerHTML =
    '<div class="tatva-here-pulse"></div><div class="tatva-here-dot"></div>'
  return d
}

// C3: still a dot — what it gains is the affordance. A marker a rep can tap must say it is tappable, and
// say WHO it is, to a pointer, a keyboard and a screen reader alike. Native attributes, no widget.
function doctorContent(d) {
  const el = document.createElement('div')
  el.className = 'tatva-doctor-pin'
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', '0')
  el.setAttribute('aria-label', d.title || d.name || __('Doctor'))
  el.title = d.title || d.name || ''
  return el
}

// One doctor is a dot; N doctors are the same dot grown to hold a number. Same hue, same white ring, same
// shadow — so zooming changes how MANY, never WHAT (C2/C4).
function clusterRenderer(g) {
  return {
    render({ count, position }) {
      const el = document.createElement('div')
      el.className = 'tatva-doctor-cluster'
      el.textContent = String(count)
      el.setAttribute('aria-label', __('{0} doctors', [count]))
      return new g.marker.AdvancedMarkerElement({ position, content: el, zIndex: 500 })
    },
  }
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
      // C2: a cluster is DOCTORS, so it wears the doctor colour. The default renderer draws a blue
              // bubble, which made blue mean both "you" and "some doctors" — the reason a rep could not find
      // themselves on their own screen. `renderer` is the library's own documented extension point
      // (@googlemaps/markerclusterer -> Renderer), so this is configuration, not a workaround.
      clusterer = new MarkerClusterer({ map, renderer: clusterRenderer(g) }) // ONCE — markers are added/cleared, never re-newed
    })().catch((e) => {
      initPromise = null
      throw e
    })
  }
  return initPromise
}

// C4: ONE selected state, expressed as a class on the marker the same way the panel expresses it as a
// class on the card. A toggled class, not a rebuild — reselecting must never re-create markers.
function applySelection() {
  for (const m of markers) {
    const on = !!props.selected && m.tatvaName === props.selected
    m.content?.classList?.toggle('is-selected', on)
    m.zIndex = on ? 600 : undefined
  }
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
      // C1: the ring is the search area around YOU, so it takes the "you" token — read from the
      // stylesheet, never a literal, so a theme change moves the map with the rest of the app.
      const blue = cssToken('--ink-blue-2')
      ring = new g.Circle({ strokeColor: blue, strokeWeight: 1, fillColor: blue, fillOpacity: 0.08 })
    }
    ring.setOptions({ map, center: centre, radius: radiusM() })
  }

  clusterer.clearMarkers()
  markers = props.doctors
    .filter((d) => d.lat != null && d.lng != null)
    .map((d) => {
      const content = doctorContent(d)
      const m = new g.marker.AdvancedMarkerElement({
        position: { lat: d.lat, lng: d.lng },
        content,
        // The selected doctor sits above its neighbours, so a highlight is never hidden under a sibling.
        zIndex: d.name === props.selected ? 600 : undefined,
      })
      m.tatvaName = d.name // the row this marker IS, so applySelection can find it without a second map
      m.addListener('click', () => emit('select', d))
      return m
    })
  clusterer.addMarkers(markers)
  applySelection()

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

// The one Retry behind both recoverable notices: re-fetch the config if that is what failed, otherwise
// re-attempt the map build (loadMapsApi cleared its promise on failure, so this really does retry).
function retry() {
  if (configFailed.value) retryMapConfig()
  else refresh(true)
}

// The config arrives async (one shared fetch); the map is built the moment it lands, and once only.
watch(mapConfig, () => queueRefresh(true), { immediate: false })
onMounted(() => mapConfig.value && refresh(true))

// One redraw per tick (NM-14): a radius change and its answering doctor set land in the same tick and
// used to fire both watchers — the first painting the OLD rows around the NEW origin. Coalesced on a
// microtask; `fit` wins because a reframe subsumes a marker-only redraw.
let queued = null
function queueRefresh(fit) {
  if (queued !== null) {
    queued = queued || fit
    return
  }
  queued = fit
  queueMicrotask(() => {
    const f = queued
    queued = null
    refresh(f)
  })
}

// The searched point, the rep's position, or the radius changed → redraw + reframe.
watch(() => [props.origin, props.here, props.radiusKm], () => queueRefresh(true))
// List changed (filter / re-query) → markers only; the user's pan and zoom are left alone.
watch(() => props.doctors, () => queueRefresh(false))
// Selection changed in the panel → repaint the highlight ONLY. No refresh, no rebuild, no reframe: the
// map must not jump because a row was highlighted (the card's own tap is what pans, via `focus`).
watch(() => props.selected, () => applySelection())
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
/* RED IS DOCTORS, at every zoom (C2). A pin and the cluster it collapses into share hue, ring and
   shadow, so zooming changes how many — never what. Colour is a token (C1): the literal #dc2626 that
   used to sit in the script is not even this app's red. */
.tatva-doctor-pin,
.tatva-doctor-cluster {
  background: var(--ink-red-3);
  border: 2px solid var(--surface-white);
  border-radius: 9999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition:
    transform 120ms ease-out,
    box-shadow 120ms ease-out;
}
.tatva-doctor-pin {
  position: relative;
  width: 14px;
  height: 14px;
}
/* MOBILE: the dot stays 14px, the TAP TARGET does not. A 14px hit area is unusable with a thumb, so an
   invisible ::after grows it to ~44px without changing what is drawn. H3 also applies — the hover grow
   below is a desktop nicety, never the affordance; on touch the affordance is the tap-to-select state. */
.tatva-doctor-pin::after,
.tatva-doctor-cluster::after {
  content: '';
  position: absolute;
  inset: -15px;
}
.tatva-doctor-cluster {
  position: relative;
}
.tatva-doctor-cluster::after {
  inset: -8px;
}
/* Same dot, grown just enough to hold its count. */
.tatva-doctor-cluster {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--surface-white);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
/* C3: the affordance. A dot a rep may tap has to answer a hover, a focus ring and a screen reader. */
.tatva-doctor-pin:hover,
.tatva-doctor-cluster:hover {
  transform: scale(1.25);
}
.tatva-doctor-pin:focus-visible,
.tatva-doctor-cluster:focus-visible {
  outline: 2px solid var(--ink-blue-2);
  outline-offset: 2px;
}
/* C4: the selected doctor, the same idea the panel expresses on the card — this one, not the others. */
.tatva-doctor-pin.is-selected {
  transform: scale(1.6);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ink-red-3) 30%, transparent);
}
/* BLUE IS YOU, and nothing else on this map is blue (C2). */
.tatva-here-dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  background: var(--ink-blue-2);
  border: 2.5px solid var(--surface-white);
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
  background: var(--ink-blue-2);
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
