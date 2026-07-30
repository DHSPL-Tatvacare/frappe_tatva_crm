<template>
  <!-- Empty + editable -->
  <div
    v-if="!value && !disabled"
    :class="[containerClasses, 'cursor-pointer']"
    @click="openModal"
  >
    <FeatherIcon name="map-pin" :class="[iconClasses, 'text-ink-gray-5']" />
    <span class="whitespace-nowrap text-ink-gray-4">{{
      __('Set location…')
    }}</span>
  </div>

  <!-- Empty + disabled -->
  <div v-else-if="!value && disabled" :class="containerClasses">
    <span class="text-ink-gray-4">—</span>
  </div>

  <!-- Has value -->
  <div
    v-else
    :class="[containerClasses, '!pr-1', 'cursor-pointer']"
    @click="openModal"
  >
    <FeatherIcon name="map-pin" :class="[iconClasses, 'text-ink-gray-7']" />
    <span class="min-w-0 flex-1 truncate text-ink-gray-8 text-sm">
      {{ coordinateSummary }}
    </span>
    <button
      v-if="!disabled"
      class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-gray-4 hover:bg-surface-gray-2 hover:text-ink-gray-7 dark:hover:bg-surface-gray-4"
      :title="__('Clear')"
      @click.prevent="clearLocation"
    >
      <FeatherIcon name="x" class="h-3 w-3" />
    </button>
  </div>

  <!-- Map Dialog -->
  <Dialog
    v-model="showModal"
    :options="{
      title: disabled ? __('View Location') : __('Set Location'),
      size: '4xl',
    }"
  >
    <template #body-content>
      <div :id="mapId" class="h-[500px] w-full rounded" />
    </template>
    <template #actions>
      <div class="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          :label="disabled ? __('Close') : __('Cancel')"
          @click="showModal = false"
        />
        <Button
          v-if="!disabled"
          variant="solid"
          :label="__('Save')"
          @click="saveLocation"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
// Static ?url imports so Vite bundles the images and resolves paths correctly
import leafletIconUrl from 'leaflet/dist/images/marker-icon.png?url'
import leafletIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png?url'
import leafletShadowUrl from 'leaflet/dist/images/marker-shadow.png?url'
import { useGeolocation } from '@vueuse/core'
import { FeatherIcon, Dialog, Button, toast } from 'frappe-ui'
import { ref, computed, watch, nextTick, useAttrs, onBeforeUnmount } from 'vue'
import { useMapConfig, mapConfig, mapConfigError } from '@/composables/mapConfig'

// The shared config, awaited at map init: land, fail, or 8 s — whichever settles first.
function waitForMapConfig(timeoutMs = 8000) {
  useMapConfig()
  if (mapConfig.value || mapConfigError.value) return Promise.resolve(mapConfig.value)
  return new Promise((resolve) => {
    const timer = setTimeout(() => { stop(); resolve(mapConfig.value) }, timeoutMs)
    const stop = watch([mapConfig, mapConfigError], ([cfg, err]) => {
      if (cfg || err) { clearTimeout(timer); stop(); resolve(cfg) }
    })
  })
}

defineOptions({ inheritAttrs: false })

const props = defineProps({
  value: { type: String, default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['change'])
const attrs = useAttrs()

// immediate:false (NM-08): the default starts a continuous watchPosition at SETUP — a location prompt
// and a live GPS drain from merely rendering a form field, before any map was opened. The watch runs
// only while the dialog is open (resume on open, pause on close); the read site's isFinite guard
// already handles the not-yet-located Infinity defaults.
const { coords: geoCoords, resume: resumeGeo, pause: pauseGeo } = useGeolocation({ immediate: false })

const showModal = ref(false)
const mapId = `geo-map-${Math.random().toString(36).slice(2)}`

// Leaflet instances — populated after dynamic import
let L = null
let mapInstance = null
let editableLayers = null
let drawControl = null

// ─── Computed ──────────────────────────────────────────────────────────────

const coordinateSummary = computed(() => {
  if (!props.value) return ''
  try {
    const geo = JSON.parse(props.value)
    // Single Point feature or FeatureCollection with one Point
    const features = geo.type === 'FeatureCollection' ? geo.features : [geo]
    const points = features.filter((f) => f.geometry?.type === 'Point')
    if (features.length === 1 && points.length === 1) {
      const [lng, lat] = points[0].geometry.coordinates
      const latStr = `${Math.abs(lat).toFixed(5)}°${lat >= 0 ? 'N' : 'S'}`
      const lngStr = `${Math.abs(lng).toFixed(5)}°${lng >= 0 ? 'E' : 'W'}`
      return `${latStr}, ${lngStr}`
    }
    const count = features.length
    return __(`{0} ${count === 1 ? 'feature' : 'features'}`, [count])
  } catch {
    return __('Invalid GeoJSON')
  }
})

// ─── Size / variant classes (mirrors AttachControl / frappe-ui TextInput) ──

const sizeClasses = computed(
  () =>
    ({
      sm: 'h-7 text-base rounded',
      md: 'h-8 text-base rounded',
      lg: 'h-10 text-lg rounded-md',
      xl: 'h-10 text-xl rounded-md',
    })[attrs.size || 'sm'],
)

const paddingClasses = computed(
  () =>
    ({
      sm: 'px-2',
      md: 'px-2.5',
      lg: 'px-3',
      xl: 'px-3',
    })[attrs.size || 'sm'],
)

const variantClasses = computed(() => {
  if (props.disabled) {
    return [
      'border bg-surface-gray-1 text-ink-gray-5',
      (attrs.variant || 'subtle') === 'outline'
        ? 'border-outline-gray-2'
        : 'border-transparent',
    ].join(' ')
  }
  return {
    subtle:
      'border border-[--surface-gray-2] bg-surface-gray-2 hover:border-outline-gray-modals hover:bg-surface-gray-3',
    outline:
      'border border-outline-gray-2 bg-surface-white hover:border-outline-gray-3 hover:shadow-sm',
    ghost: 'border-0',
  }[attrs.variant || 'subtle']
})

const iconClasses = computed(
  () =>
    ({
      sm: 'h-3 w-3 shrink-0',
      md: 'h-3.5 w-3.5 shrink-0',
      lg: 'h-4 w-4 shrink-0',
      xl: 'h-4 w-4 shrink-0',
    })[attrs.size || 'sm'],
)

const containerClasses = computed(() =>
  [
    'flex w-full items-center gap-1.5 overflow-hidden transition-colors',
    sizeClasses.value,
    paddingClasses.value,
    variantClasses.value,
    attrs.class,
  ]
    .filter(Boolean)
    .join(' '),
)

// ─── Map lifecycle ──────────────────────────────────────────────────────────

function openModal() {
  showModal.value = true
}

watch(showModal, (visible) => {
  if (!visible) {
    pauseGeo() // the GPS watch lives exactly as long as the dialog (NM-08)
    destroyMap()
    return
  }
  resumeGeo()
  useMapConfig() // kick the ONE shared config fetch the moment the dialog opens (NM-09)
  nextTick(() => initMap())
})

async function initMap() {
  // Lazy-load Leaflet + leaflet-draw + their CSS on first open
  if (!L) {
    await import('leaflet/dist/leaflet.css')
    await import('leaflet-draw/dist/leaflet.draw.css')
    const leafletModule = await import('leaflet')
    L = leafletModule.default ?? leafletModule
    await import('leaflet-draw')

    // Fix Vite marker image paths — delete the built-in resolver first,
    // then supply the already-resolved ?url import strings
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl: leafletIconUrl,
      iconRetinaUrl: leafletIconRetinaUrl,
      shadowUrl: leafletShadowUrl,
    })

    // Patch Circle/CircleMarker toGeoJSON to include radius in properties
    // (same patch as Frappe's customize_draw_controls)
    const circleToGeoJSON = L.Circle.prototype.toGeoJSON
    L.Circle.include({
      toGeoJSON() {
        const feature = circleToGeoJSON.call(this)
        feature.properties = { point_type: 'circle', radius: this.getRadius() }
        return feature
      },
    })
    L.CircleMarker.include({
      toGeoJSON() {
        const feature = circleToGeoJSON.call(this)
        feature.properties = {
          point_type: 'circlemarker',
          radius: this.getRadius(),
        }
        return feature
      },
    })
  }

  // Dialog uses v-if internally — the map div is destroyed on close and
  // recreated on open. Always create a fresh instance; destroyMap() on close
  // ensures mapInstance is null here.
  mapInstance = L.map(mapId)

  // ── Tiles: the STREET layer comes from the ONE map config (NM-09) ─────────
  // This control was a second map-config brain — it hardcoded its own street tiles, so an operator's
  // CRM Maps Settings tile URL was honoured on the task mini-map and silently ignored here. The server
  // resolves the default (location/api.map_config); the client never re-declares one.
  const cfg = await waitForMapConfig()
  if (!cfg?.tile_url) {
    toast.error(__('The map settings could not be loaded. Try again.'))
    destroyMap()
    showModal.value = false
    return
  }
  const streetLayer = L.tileLayer(cfg.tile_url, {
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  })
  // Imagery is a different CAPABILITY, not a second copy of the street config, so the switcher stays.
  // The two Stadia overlays that used to sit beside it are gone: those endpoints require an API key for
  // production traffic and had none, so they were a broken tile layer waiting for real load.
  const satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '© Esri © OpenStreetMap Contributors' },
  )

  streetLayer.addTo(mapInstance)
  L.control
    .layers({ Default: streetLayer, Satellite: satelliteLayer })
    .addTo(mapInstance)

  // ── Locate control ───────────────────────────────────────────────────────
  // Lazy-load leaflet.locatecontrol CSS + plugin
  await import('leaflet.locatecontrol/dist/L.Control.Locate.min.css')
  const { locate: leafletLocate } = await import('leaflet.locatecontrol')
  leafletLocate({ position: 'topright' }).addTo(mapInstance)

  editableLayers = new L.FeatureGroup()
  editableLayers.addTo(mapInstance)

  // Draw controls — only in edit mode
  if (!props.disabled) {
    drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polyline: { shapeOptions: { color: '#4f46e5', weight: 4 } },
        polygon: {
          allowIntersection: false,
          shapeOptions: { color: '#4f46e5' },
        },
        circle: true,
        rectangle: { shapeOptions: { clickable: false } },
        circlemarker: true,
        marker: true,
      },
      edit: { featureGroup: editableLayers, remove: true },
    })
    drawControl.addTo(mapInstance)

    mapInstance.on('draw:created', (e) => {
      editableLayers.addLayer(e.layer)
    })

    mapInstance.on('draw:deleted', (e) => {
      e.layers.eachLayer((l) => editableLayers.removeLayer(l))
    })
  }

  reloadData()
}

function reloadData() {
  if (!L || !editableLayers || !mapInstance) return

  // Clear existing layers
  editableLayers.clearLayers()

  // Device location when available; else a neutral world view — never a hardcoded city (NM-09): a
  // fabricated Mumbai default is a client re-declaring what only the device or the record may say.
  const { latitude, longitude } = geoCoords.value
  const located = isFinite(latitude) && isFinite(longitude)
  mapInstance.setView(located ? [latitude, longitude] : [0, 0], located ? 13 : 2)

  if (!props.value) return

  try {
    const geoData = JSON.parse(props.value)
    const dataGroup = new L.FeatureGroup().addLayer(
      L.geoJSON(geoData, {
        pointToLayer(geoJsonPoint, latlng) {
          const pt = geoJsonPoint.properties?.point_type
          if (pt === 'circle') {
            return L.circle(latlng, {
              radius: geoJsonPoint.properties.radius,
            })
          }
          if (pt === 'circlemarker') {
            return L.circleMarker(latlng, {
              radius: geoJsonPoint.properties.radius,
            })
          }
          return L.marker(latlng)
        },
      }),
    )
    addNonGroupLayers(dataGroup, editableLayers)
    fitMap()
  } catch {
    // Invalid JSON — ignore
  }
}

function addNonGroupLayers(source, target) {
  if (source instanceof L.LayerGroup) {
    source.eachLayer((l) => addNonGroupLayers(l, target))
  } else {
    target.addLayer(source)
  }
}

function fitMap() {
  mapInstance.invalidateSize()
  const bounds = editableLayers.getBounds()
  if (bounds.isValid()) {
    // fitBounds works for multi-point layers; for a single point the bounds
    // have zero area so we zoom manually instead.
    const ne = bounds.getNorthEast()
    const sw = bounds.getSouthWest()
    if (ne.equals(sw)) {
      mapInstance.setView(ne, 14)
    } else {
      mapInstance.fitBounds(bounds, { padding: [50, 50] })
    }
  }
}

// ─── Actions ────────────────────────────────────────────────────────────────

function saveLocation() {
  if (!editableLayers) {
    showModal.value = false
    return
  }
  const geoJson = editableLayers.toGeoJSON()
  const hasFeatures = geoJson.features?.length > 0
  emit('change', hasFeatures ? JSON.stringify(geoJson) : null)
  showModal.value = false
}

function clearLocation() {
  emit('change', null)
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

function destroyMap() {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
    editableLayers = null
    drawControl = null
  }
}

onBeforeUnmount(() => destroyMap())
</script>
