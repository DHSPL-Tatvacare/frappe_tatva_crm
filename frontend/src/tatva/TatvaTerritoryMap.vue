<!--
  TatvaTerritoryMap — the interactive Near Me map. A "you" marker + radius circle at the rep's
  device location, plus doctor markers grouped with leaflet.markercluster (cluster counts that
  split on zoom). Provider/tile come from tatva_connect.location.api.map_config (OSM tile_url).
  Lazy-init + full cleanup on unmount, mirroring TatvaMiniMap. Pure presentation — every datum
  is a prop; clicking a marker emits `select`, and a `focus` prop pan-zooms the map.
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

const props = defineProps({
  here: { type: Object, default: null }, // { lat, lng } — the rep's device location
  doctors: { type: Array, default: () => [] },
  radiusKm: { type: [Number, String], default: 15 },
  focus: { type: Object, default: null }, // { lat, lng } — pan-zoom target
})

const emit = defineEmits(['select'])

const el = ref(null)
let map = null
let cluster = null
let hereMarker = null
let radiusCircle = null
let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

function destroy() {
  if (map) {
    map.remove()
    map = null
    cluster = null
    hereMarker = null
    radiusCircle = null
  }
}

function ensureMap() {
  if (map || !el.value) return
  const center = props.here || (props.doctors[0] ?? { lat: 20.5937, lng: 78.9629 })
  map = L.map(el.value, { zoomControl: true, attributionControl: false }).setView(
    [center.lat, center.lng],
    13,
  )
  L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map)
  cluster = L.markerClusterGroup({ showCoverageOnHover: false })
  map.addLayer(cluster)
  setTimeout(() => map && map.invalidateSize(), 60)
}

function drawHere() {
  if (!map || !props.here) return
  if (hereMarker) hereMarker.remove()
  if (radiusCircle) radiusCircle.remove()
  hereMarker = L.circleMarker([props.here.lat, props.here.lng], {
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: '#2563eb',
    fillOpacity: 1,
  }).addTo(map)
  radiusCircle = L.circle([props.here.lat, props.here.lng], {
    radius: (props.radiusKm || 0) * 1000,
    color: '#2563eb',
    weight: 1,
    fillColor: '#2563eb',
    fillOpacity: 0.08,
  }).addTo(map)
}

// `fit` re-frames the view to the markers — only on first load / radius change, NEVER on a list
// filter, so narrowing the list doesn't yank the rep's manual pan/zoom around.
function drawDoctors(fit) {
  if (!map || !cluster) return
  cluster.clearLayers()
  const pts = []
  props.doctors.forEach((d) => {
    if (d.lat == null || d.lng == null) return
    const m = L.circleMarker([d.lat, d.lng], {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#dc2626',
      fillOpacity: 1,
    })
    m.on('click', () => emit('select', d))
    cluster.addLayer(m)
    pts.push([d.lat, d.lng])
  })
  if (props.here) pts.push([props.here.lat, props.here.lng])
  if (fit && pts.length > 1) map.fitBounds(pts, { padding: [32, 32], maxZoom: 15 })
}

function refresh(fit) {
  ensureMap()
  drawHere()
  drawDoctors(fit)
}

onMounted(async () => {
  try {
    const cfg = await call('tatva_connect.location.api.map_config')
    if (cfg && cfg.tile_url) tileUrl = cfg.tile_url
  } catch {
    // keep the OSM default tile on any config error
  }
  refresh(true)
})

// Device location or radius changed → redraw and re-fit. (Deep so the `here`/`radiusKm` swap lands.)
watch(() => [props.here, props.radiusKm], () => refresh(true), { deep: true })

// List changed (a filter, a re-query result) → redraw markers only, keep the current view.
watch(() => props.doctors, () => drawDoctors(false), { deep: true })

watch(
  () => props.focus,
  (f) => {
    if (map && f && f.lat != null && f.lng != null) map.setView([f.lat, f.lng], 16)
  },
)

onBeforeUnmount(destroy)
</script>
