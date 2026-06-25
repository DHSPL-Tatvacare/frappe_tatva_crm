<!--
  TatvaTerritoryMap — the interactive Near Me map. A "you" marker + radius circle at the rep's device
  location, plus clustered doctor markers (counts that split on zoom). The PROVIDER is operator-chosen
  per tatva_connect.location.api.map_config().nearme:
    • 'osm'    → Leaflet + OSM tiles (free, keyless) + leaflet.markercluster.
    • 'google' → the Google Maps JavaScript API (loaded with the referrer-restricted browser key from
                 map_config().browser_key) + @googlemaps/markerclusterer (bundled npm dep).
  Only the Maps JS API is loaded via Google's prescribed <script> include (the key must reach the
  browser); the clusterer is a normal import. If Google fails to load (or no key) we fall back to OSM
  so the map is never broken. Both providers draw the SAME pulsing "you" dot (one .tatva-here CSS
  source) and frame the search radius on load. Lazy-init + full cleanup on unmount. Pure presentation
  — every datum is a prop; clicking a marker emits `select`, a `focus` prop pan-zooms.
-->
<template>
  <div ref="el" class="h-full w-full bg-surface-gray-2" />
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import { call } from 'frappe-ui'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { MarkerClusterer } from '@googlemaps/markerclusterer'

const props = defineProps({
  here: { type: Object, default: null }, // { lat, lng } — the rep's device location
  doctors: { type: Array, default: () => [] },
  radiusKm: { type: [Number, String], default: 15 },
  focus: { type: Object, default: null }, // { lat, lng } — pan-zoom target
})

const emit = defineEmits(['select'])

const el = ref(null)
const BLUE = '#2563eb'
const RED = '#dc2626'
const WHITE = '#ffffff'

// resolved from map_config() on mount; defaults keep us on free, keyless OSM.
let provider = 'osm'
let browserKey = ''
let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

// Leaflet (OSM) handles
let lmap = null
let lcluster = null
let lhere = null
let lcircle = null
// Google handles
let gmap = null
let gcluster = null
let ghere = null
let gcircle = null
let gmarkers = []

const radiusM = () => (Number(props.radiusKm) || 0) * 1000

// Google's prescribed external <script> include (one-time, de-duped by src). Not a DOM hack — it's the
// only supported way to load the Maps JS API / clusterer; everything else is real components.
function loadScript(src, ready) {
  return new Promise((resolve, reject) => {
    if (ready()) return resolve()
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('load failed')))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.addEventListener('load', () => resolve())
    s.addEventListener('error', () => reject(new Error('load failed')))
    document.head.appendChild(s)
  })
}

function waitFor(cond, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    ;(function poll() {
      if (cond()) return resolve()
      if (Date.now() - t0 > ms) return reject(new Error('timeout'))
      setTimeout(poll, 50)
    })()
  })
}

// ---------------- OSM (Leaflet) ----------------
function ensureOsm() {
  if (lmap || !el.value) return
  const c = props.here || props.doctors[0] || { lat: 20.5937, lng: 78.9629 }
  lmap = L.map(el.value, { zoomControl: true, attributionControl: false }).setView([c.lat, c.lng], 13)
  L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(lmap)
  lcluster = L.markerClusterGroup({ showCoverageOnHover: false })
  lmap.addLayer(lcluster)
  setTimeout(() => lmap && lmap.invalidateSize(), 60)
}

function drawOsm(fit) {
  if (!lmap) return
  if (fit && props.here) {
    if (lhere) lhere.remove()
    if (lcircle) lcircle.remove()
    // Google-Maps-style "you are here": a prominent blue dot (white ring + shadow) under a soft
    // pulsing concentric halo — far more legible than the old 7px dot. (divIcon HTML so CSS can pulse.)
    lhere = L.marker([props.here.lat, props.here.lng], {
      icon: L.divIcon({
        className: 'tatva-here',
        html: `<div class="tatva-here-pulse" style="background:${BLUE}"></div><div class="tatva-here-dot" style="background:${BLUE}"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(lmap)
    lcircle = L.circle([props.here.lat, props.here.lng], {
      radius: radiusM(), color: BLUE, weight: 1, fillColor: BLUE, fillOpacity: 0.08,
    }).addTo(lmap)
    // Frame the whole search area from the radius circle (a known geometry) — deterministic, so the
    // view never depends on whether markers have arrived yet. All in-range doctors sit inside it.
    lmap.fitBounds(lcircle.getBounds(), { padding: [24, 24] })
  }
  lcluster.clearLayers()
  props.doctors.forEach((d) => {
    if (d.lat == null || d.lng == null) return
    const m = L.circleMarker([d.lat, d.lng], {
      radius: 6, color: WHITE, weight: 2, fillColor: RED, fillOpacity: 1,
    })
    m.on('click', () => emit('select', d))
    lcluster.addLayer(m)
  })
}

// ---------------- Google (JS API) ----------------
async function ensureGoogle() {
  if (gmap || !el.value) return
  await loadScript(
    `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserKey)}`,
    () => window.google?.maps?.Map,
  )
  await waitFor(() => window.google?.maps?.Map)
  if (gmap || !el.value) return
  const c = props.here || props.doctors[0] || { lat: 20.5937, lng: 78.9629 }
  gmap = new window.google.maps.Map(el.value, {
    center: { lat: c.lat, lng: c.lng }, zoom: 13,
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
  })
}

// The "you are here" marker for Google: a DOM OverlayView reusing the SAME .tatva-here markup/CSS as
// the OSM divIcon, so both providers render the identical pulsing concentric dot (one style source, no
// divergence). OverlayView extends google.maps.OverlayView, only defined once the API has loaded.
function makeHereOverlay(g, pos) {
  class HereOverlay extends g.OverlayView {
    constructor(p) { super(); this.p = p; this.div = null }
    onAdd() {
      this.div = document.createElement('div')
      this.div.className = 'tatva-here'
      this.div.style.position = 'absolute'
      this.div.innerHTML =
        `<div class="tatva-here-pulse" style="background:${BLUE}"></div>` +
        `<div class="tatva-here-dot" style="background:${BLUE}"></div>`
      this.getPanes().overlayLayer.appendChild(this.div)
    }
    draw() {
      const pt = this.getProjection()?.fromLatLngToDivPixel(new g.LatLng(this.p.lat, this.p.lng))
      if (this.div && pt) { this.div.style.left = `${pt.x}px`; this.div.style.top = `${pt.y}px` }
    }
    onRemove() { if (this.div) { this.div.remove(); this.div = null } }
  }
  return new HereOverlay(pos)
}

function drawGoogle(fit) {
  if (!gmap) return
  const g = window.google.maps
  if (fit && props.here) {
    if (ghere) ghere.setMap(null)
    if (gcircle) gcircle.setMap(null)
    ghere = makeHereOverlay(g, props.here)
    ghere.setMap(gmap)
    gcircle = new g.Circle({
      center: props.here, radius: radiusM(), map: gmap,
      strokeColor: BLUE, strokeWeight: 1, fillColor: BLUE, fillOpacity: 0.08,
    })
    // Frame the whole search area from the radius circle — deterministic (no dependence on marker
    // arrival), matching the OSM path. All in-range doctors sit inside it.
    gmap.fitBounds(gcircle.getBounds(), 24)
  }
  if (gcluster) { try { gcluster.clearMarkers() } catch (e) {} gcluster = null }
  gmarkers.forEach((m) => m.setMap(null))
  gmarkers = []
  props.doctors.forEach((d) => {
    if (d.lat == null || d.lng == null) return
    const m = new g.Marker({
      position: { lat: d.lat, lng: d.lng },
      icon: { path: g.SymbolPath.CIRCLE, scale: 6, fillColor: RED, fillOpacity: 1, strokeColor: WHITE, strokeWeight: 2 },
    })
    m.addListener('click', () => emit('select', d))
    gmarkers.push(m)
  })
  gcluster = new MarkerClusterer({ map: gmap, markers: gmarkers })
}

// ---------------- dispatch ----------------
async function refresh(fit) {
  if (provider === 'google') {
    try {
      await ensureGoogle()
      drawGoogle(fit)
      return
    } catch (e) {
      provider = 'osm' // Google failed to load → never leave a broken map
    }
  }
  ensureOsm()
  drawOsm(fit)
}

function destroy() {
  if (lmap) { lmap.remove(); lmap = null; lcluster = null; lhere = null; lcircle = null }
  if (gcluster) { try { gcluster.clearMarkers() } catch (e) {} gcluster = null }
  gmarkers.forEach((m) => { try { m.setMap(null) } catch (e) {} })
  gmarkers = []
  if (ghere) { try { ghere.setMap(null) } catch (e) {} ghere = null }
  gmap = null; gcircle = null
}

onMounted(async () => {
  try {
    const cfg = await call('tatva_connect.location.api.map_config')
    if (cfg) {
      if (cfg.tile_url) tileUrl = cfg.tile_url
      if (cfg.nearme === 'google' && cfg.browser_key) { provider = 'google'; browserKey = cfg.browser_key }
    }
  } catch (e) {
    // keep OSM defaults on any config error
  }
  refresh(true)
})

// Device location / radius changed → redraw + re-fit (and re-draw the you-marker + radius ring).
watch(() => [props.here, props.radiusKm], () => refresh(true), { deep: true })
// List changed (filter / re-query) → redraw markers only, keep the current view (no fit, no ring churn).
watch(() => props.doctors, () => refresh(false), { deep: true })
// A card was tapped → centre on it.
watch(
  () => props.focus,
  (f) => {
    if (!f || f.lat == null || f.lng == null) return
    if (gmap) { gmap.panTo({ lat: f.lat, lng: f.lng }); gmap.setZoom(16) }
    else if (lmap) lmap.setView([f.lat, f.lng], 16)
  },
)

// Recenter on the rep's own location (the crosshair control in the page).
function recenter() {
  if (!props.here) return
  if (gmap) { gmap.panTo({ lat: props.here.lat, lng: props.here.lng }); gmap.setZoom(14) }
  else if (lmap) lmap.setView([props.here.lat, props.here.lng], 14)
}
defineExpose({ recenter })

onBeforeUnmount(destroy)
</script>

<!-- NOT scoped: Leaflet renders the divIcon HTML outside this component's scoped DOM. Class names are
     namespaced (tatva-here-*) so this is collision-safe. The blue is inlined from the JS BLUE const. -->
<style>
.tatva-here {
  background: transparent;
  border: 0;
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
