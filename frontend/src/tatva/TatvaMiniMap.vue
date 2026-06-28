<!--
  TatvaMiniMap — the ONE map renderer for the activity UI, provider-aware (operator-switchable).

  provider='osm'    → Leaflet + OSM tiles (free, no key). Tile URL is operator-configurable
                      (CRM Maps Settings → OpenStreetMap Tile URL) so 300-user traffic can point at a
                      proper/proxied tile source instead of the public server.
  provider='google' → the server static_map proxy PNG (key stays server-side; native loading="lazy").

  LAZY: the OSM map only initialises when it scrolls into view (IntersectionObserver) — long lists stay
  fast. Supports one marker, or two (`here` set → clinic + you, auto-fitted), so the SAME component
  renders card thumbnails, the detail-modal map, AND the block/receipt dialog maps. circleMarker (pure
  SVG) avoids Leaflet's broken default-icon paths. Cleans up on unmount.
-->
<template>
  <div ref="el" class="tc-minimap relative overflow-hidden rounded-md bg-surface-gray-2">
    <img
      v-if="provider === 'google' && googleUrl"
      :src="googleUrl"
      alt="map"
      loading="lazy"
      class="absolute inset-0 h-full w-full object-cover"
      @error="(e) => (e.target.style.visibility = 'hidden')"
    />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, computed, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  zoom: { type: Number, default: 15 },
  provider: { type: String, default: 'osm' }, // 'osm' | 'google'
  here: { type: Object, default: null }, // { lat, lng } → second marker (clinic + you), auto-fitted
  tileUrl: { type: String, default: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
})

const el = ref(null)
const visible = ref(false)
let map = null
let markers = []
let observer = null

// Google surface: the key-safe server proxy (one marker, or two when `here` is set).
const googleUrl = computed(() => {
  if (props.lat == null || props.lng == null) return ''
  let u = `/api/method/tatva_connect.location.api.static_map?lat=${encodeURIComponent(props.lat)}&lng=${encodeURIComponent(props.lng)}`
  if (props.here) u += `&here_lat=${encodeURIComponent(props.here.lat)}&here_lng=${encodeURIComponent(props.here.lng)}`
  return u
})

function destroy() {
  if (map) {
    map.remove()
    map = null
    markers = []
  }
}

function dot(lat, lng, color) {
  return L.circleMarker([lat, lng], {
    radius: 6,
    color: '#ffffff',
    weight: 2,
    fillColor: color,
    fillOpacity: 1,
  }).addTo(map)
}

function drawMarkers() {
  markers.forEach((m) => m.remove())
  markers = []
  if (props.here) {
    // Two points: clinic (red) + you (blue), auto-fit to show both — the out-of-range block view.
    markers.push(dot(props.lat, props.lng, '#dc2626'))
    markers.push(dot(props.here.lat, props.here.lng, '#2563eb'))
    map.fitBounds(
      [
        [props.lat, props.lng],
        [props.here.lat, props.here.lng],
      ],
      { padding: [24, 24], maxZoom: 16 },
    )
  } else {
    markers.push(dot(props.lat, props.lng, '#2563eb'))
    map.setView([props.lat, props.lng], props.zoom)
  }
}

// Render only once visible (lazy) and only for OSM (Google is a plain lazy <img>).
function render() {
  if (!visible.value) return
  if (props.provider === 'google') return destroy()
  if (!el.value || props.lat == null || props.lng == null) return
  if (map) return drawMarkers()
  map = L.map(el.value, {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
  })
  L.tileLayer(props.tileUrl, { maxZoom: 19 }).addTo(map)
  drawMarkers()
  // The container often mounts at 0×0 inside a flex card; force a resize once laid out.
  setTimeout(() => map && map.invalidateSize(), 60)
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !el.value) {
    visible.value = true
    return render()
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        visible.value = true
        render()
        observer?.disconnect()
      }
    },
    { rootMargin: '100px' },
  )
  observer.observe(el.value)
})

watch(
  () => [props.provider, props.lat, props.lng, props.here, props.tileUrl],
  () => (props.provider === 'google' ? destroy() : render()),
  { deep: true },
)

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  destroy()
})
</script>
