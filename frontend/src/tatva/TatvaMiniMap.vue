<!--
  TatvaMiniMap — a small, reliable, non-interactive OSM map thumbnail.

  Uses Leaflet (already a CRM dependency) with canonical OSM tiles (tile.openstreetmap.org) — reliable,
  no API key, no Google cost on the frontend (Google stays server-side for geo math only). A circleMarker
  (pure SVG) avoids Leaflet's broken default-icon asset paths. Interactions are disabled — it reads as a
  static thumbnail. Cleans up its map instance on unmount.
-->
<template>
  <div ref="el" class="tc-minimap h-full w-full overflow-hidden rounded-md bg-surface-gray-2" />
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  zoom: { type: Number, default: 15 },
})

const el = ref(null)
let map = null
let marker = null

function init() {
  if (map || !el.value || props.lat == null || props.lng == null) return
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
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
  map.setView([props.lat, props.lng], props.zoom)
  marker = L.circleMarker([props.lat, props.lng], {
    radius: 6,
    color: '#ffffff',
    weight: 2,
    fillColor: '#2563eb',
    fillOpacity: 1,
  }).addTo(map)
  // The container often mounts at 0×0 inside a flex card; force a resize once laid out.
  setTimeout(() => map && map.invalidateSize(), 60)
}

onMounted(init)

watch(
  () => [props.lat, props.lng],
  () => {
    if (!map) return init()
    map.setView([props.lat, props.lng], props.zoom)
    marker && marker.setLatLng([props.lat, props.lng])
  },
)

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>
