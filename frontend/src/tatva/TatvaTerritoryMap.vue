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
  pan-zooms, `recenter()` is exposed for the page's crosshair. Hovering a pin (pointer devices only) shows the
  page's `#peek` slot above it, teleported into one reused marker.
-->
<template>
  <div class="relative h-full w-full">
    <!-- `tatva-map-labelled` at street zoom shows every pin's name; below it only the selected pin's. -->
    <div
      ref="el"
      class="h-full w-full bg-surface-gray-2"
      :class="labelled ? 'tatva-map-labelled' : ''"
    />
    <Teleport v-if="peekHost && peek" :to="peekHost">
      <slot name="peek" :doctor="peek" />
    </Teleport>
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
import { onMounted, onBeforeUnmount, watch, ref, shallowRef, computed } from 'vue'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import TatvaMapUnavailable from '@/tatva/TatvaMapUnavailable.vue'
import { useMapConfig, mapConfigError, retryMapConfig } from '@/composables/mapConfig'
import { cssToken } from '@/utils'
import { isMobileView } from '@/composables/settings'
import { liveTheme } from '@/tatva/themeColor'

const props = defineProps({
  here: { type: Object, default: null }, // { lat, lng } — where the rep IS (the pulsing dot)
  accuracy: { type: Number, default: 0 }, // metres of doubt in `here` — drawn as the halo around the dot
  origin: { type: Object, default: null }, // { lat, lng } — what is being SEARCHED around (ring + fit)
  doctors: { type: Array, default: () => [] },
  radiusKm: { type: [Number, String], default: 0 },
  focus: { type: Object, default: null }, // { lat, lng } — pan-zoom target
  selected: { type: String, default: '' }, // the doctor `name` currently selected in the panel (C4)
  // px of the map hidden under the page's floating panel or sheet: framing and centring work in what the rep can SEE.
  inset: { type: Object, default: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) },
  // My day: each pin wears its stop number (the row's order) and nothing clusters, so every number stays on the map.
  numbered: { type: Boolean, default: false },
  // My day's line: { encoded } — Google's road path, decoded by Google's own geometry library — or { points } drawn straight.
  route: { type: Object, default: null },
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
let halo = null
let ring = null
let line = null
let initPromise = null // one shared init: concurrent refreshes await the same build, never race a second map

// Street zoom, where a pin's name fits beside its neighbours.
const LABEL_ZOOM = 15
const labelled = ref(false)

// The hover card: ONE marker whose content is a host the page's slot teleports into. Pointer devices only — touch has no hover.
const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
const peek = ref(null)
const peekHost = shallowRef(null)
let peekMarker = null
let peekTimer = null
// Long enough to cross the gap from the pin into the card without it closing.
const PEEK_GRACE_MS = 150

function showPeek(d) {
  clearTimeout(peekTimer)
  if (!map || !peekMarker) return
  peek.value = d
  peekMarker.position = { lat: d.lat, lng: d.lng }
  peekMarker.map = map
}
function hidePeekSoon() {
  clearTimeout(peekTimer)
  peekTimer = setTimeout(hidePeek, PEEK_GRACE_MS)
}
function hidePeek() {
  clearTimeout(peekTimer)
  peek.value = null
  if (peekMarker) peekMarker.map = null
}

const radiusM = () => (Number(props.radiusKm) || 0) * 1000
// Below this the halo would sit inside the dot and add nothing but noise.
const HALO_MIN_M = 50

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
      `&libraries=marker,geometry&loading=async&v=weekly&callback=${MAPS_READY_CALLBACK}`
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
// The name label hangs below the dot (absolute), so showing it never moves the pin's anchor. textContent, never HTML.
function doctorContent(d, number) {
  const el = document.createElement('div')
  el.className = 'tatva-doctor-marker'
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', '0')
  el.setAttribute('aria-label', d.title || d.name || __('Doctor'))
  if (!canHover) el.title = d.title || d.name || ''
  const dot = document.createElement('div')
  dot.className = number ? 'tatva-doctor-pin is-numbered' : 'tatva-doctor-pin'
  if (number) dot.textContent = String(number)
  const label = document.createElement('div')
  label.className = 'tatva-doctor-label'
  label.textContent = d.title || d.name || ''
  el.append(dot, label)
  if (canHover) {
    el.addEventListener('pointerenter', () => showPeek(d))
    el.addEventListener('pointerleave', hidePeekSoon)
  }
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
      el.setAttribute('aria-label', __('{0} in registry', [count]))
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
        // The theme the app painted (`data-theme`, which light/dark/system all resolve to); Google reads it at build only, so a change rebuilds (below).
        colorScheme: liveTheme.value === 'dark' ? 'DARK' : 'LIGHT',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        // Zoom sits on the left, clear of the panel floating on the right; touch zooms by pinch.
        cameraControl: false,
        zoomControl: !isMobileView.value,
        zoomControlOptions: { position: g.ControlPosition.INLINE_START_BLOCK_END },
      })
      map.addListener('zoom_changed', () => (labelled.value = map.getZoom() >= LABEL_ZOOM))
      map.addListener('dragstart', hidePeek)
      if (canHover) {
        const host = document.createElement('div')
        host.className = 'tatva-peek'
        host.addEventListener('pointerenter', () => clearTimeout(peekTimer))
        host.addEventListener('pointerleave', hidePeekSoon)
        peekHost.value = host
        peekMarker = new g.marker.AdvancedMarkerElement({ content: host, zIndex: 2000 })
      }
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

// The dot and its halo, ON THEIR OWN: a reading sharpens several times a second, and dragging every pin through a clear+rebuild+recluster each time is what turns a map to treacle in a rep's hand.
function drawHere() {
  if (!map || !props.here) return
  const g = window.google.maps
  if (!hereMarker) {
    hereMarker = new g.marker.AdvancedMarkerElement({ map, content: hereContent(), zIndex: 1000 })
  }
  hereMarker.position = props.here
  // Maps' own grammar: a reading the device cannot pin wears a halo the size of its doubt, so a rep sees an area rather than a confident point.
  const doubt = Number(props.accuracy) || 0
  if (doubt > HALO_MIN_M) {
    if (!halo) {
      const blue = cssToken('--ink-blue-2')
      halo = new g.Circle({ strokeOpacity: 0, fillColor: blue, fillOpacity: 0.15, clickable: false })
    }
    halo.setOptions({ map, center: props.here, radius: doubt })
  } else if (halo) {
    halo.setMap(null)
  }
}

// One polyline, re-pathed in place: the day's order changes its points, never the object.
function drawRoute() {
  if (!map) return
  const g = window.google.maps
  const r = props.route
  const path = !r ? [] : r.encoded ? g.geometry.encoding.decodePath(r.encoded) : r.points || []
  if (!path.length) {
    line?.setMap(null)
    return
  }
  // The route is the rep's own way through the day, so it takes the "you" token, read once from the stylesheet (C1).
  if (!line) line = new g.Polyline({ strokeColor: cssToken('--ink-blue-2'), strokeOpacity: 0.8, strokeWeight: 4, clickable: false })
  line.setOptions({ map, path })
}

// `fit` reframes the view (the searched point or radius changed); a data-only change redraws markers and
// leaves the user's current pan/zoom exactly where they left it.
function draw(fit) {
  if (!map) return
  const g = window.google.maps

  // The dot follows the rep; the ring follows what is being searched. After an area search those are
  // two different places, and drawing the rep's dot around a Dubai search would be a lie.
  drawHere()
  const centre = props.origin || props.here
  if (fit && centre) {
    if (!ring) {
      // C1: the ring is the search area around YOU, so it takes the "you" token — read from the
      // stylesheet, never a literal, so a theme change moves the map with the rest of the app.
      const blue = cssToken('--ink-blue-2')
      ring = new g.Circle({ strokeColor: blue, strokeWeight: 1, fillColor: blue, fillOpacity: 0.08 })
    }
    // radius 0 = no ring (a name search is not an area); it must leave the map, since a collapsed circle still fits to a zero-size bounds.
    if (radiusM() > 0)
      ring.setOptions({ map, center: centre, radius: radiusM() })
    else ring.setMap(null)
  }

  hidePeek() // the hovered row may be gone, and the card must never outlive its pin
  clusterer.clearMarkers()
  markers.forEach((m) => (m.map = null)) // a numbered day never went through the clusterer
  markers = props.doctors
    .filter((d) => d.lat != null && d.lng != null)
    .map((d, i) => {
      const content = doctorContent(d, props.numbered ? i + 1 : 0)
      const m = new g.marker.AdvancedMarkerElement({
        position: { lat: d.lat, lng: d.lng },
        content,
        // The selected doctor sits above its neighbours, so a highlight is never hidden under a sibling.
        zIndex: d.name === props.selected ? 600 : undefined,
      })
      m.tatvaName = d.name // the row this marker IS, so applySelection can find it without a second map
      m.addListener('click', () => {
        hidePeek()
        emit('select', d)
      })
      return m
    })
  if (props.numbered) markers.forEach((m) => (m.map = map))
  else clusterer.addMarkers(markers)
  applySelection()
  drawRoute()

  if (!fit) return
  // Frame the search ring (a known geometry, so the first paint never waits on markers), then widen to
  // the doctors if any sit outside it — a result set you cannot see is the same as no result set.
  const bounds = new g.LatLngBounds()
  if (ring && radiusM() > 0) bounds.union(ring.getBounds())
  markers.forEach((m) => bounds.extend(m.position))
  if (bounds.isEmpty()) return
  // One result is a point, and fitBounds on a point zooms to the maximum; centre it at street zoom instead.
  if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
    map.setCenter(bounds.getCenter())
    map.setZoom(14)
    return
  }
  const i = props.inset
  map.fitBounds(bounds, { top: 24 + i.top, right: 24 + i.right, bottom: 24 + i.bottom, left: 24 + i.left })
}

function destroy() {
  hidePeek()
  peekMarker = null
  peekHost.value = null
  if (clusterer) {
    clusterer.clearMarkers()
    clusterer.setMap(null)
    clusterer = null
  }
  markers.forEach((m) => (m.map = null))
  markers = []
  if (hereMarker) hereMarker.map = null
  hereMarker = null
  if (halo) halo.setMap(null)
  halo = null
  if (ring) ring.setMap(null)
  ring = null
  if (line) line.setMap(null)
  line = null
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

// Google cannot recolour a built map, so a theme change rebuilds it in place, reframed on the same search.
watch(liveTheme, () => {
  if (!map) return
  destroy()
  el.value?.replaceChildren() // our own container: the old map's DOM goes before a new map takes it
  queueRefresh(true)
})
// The day's line follows its own data; no markers rebuild for it.
watch(() => props.route, drawRoute)
// Registry ↔ My day is a different set of places, so it reframes.
watch(() => props.numbered, () => queueRefresh(true))
// The searched point or the radius changed → redraw + reframe.
watch(() => [props.origin, props.radiusKm], () => queueRefresh(true))
// The rep moved, or the reading sharpened → the dot and halo move and NOTHING else: no marker rebuild, no reframe.
watch(() => [props.here, props.accuracy], () => drawHere()) // drawHere no-ops until the map exists
// List changed (filter / re-query) → markers only; the user's pan and zoom are left alone.
watch(() => props.doctors, () => queueRefresh(false))
// Selection changed in the panel → repaint the highlight ONLY. No refresh, no rebuild, no reframe: the
// map must not jump because a row was highlighted (the card's own tap is what pans, via `focus`).
watch(() => props.selected, () => applySelection())
// Where a point sits in the map's own pixels, from Google's projection at the current zoom; null until the map has a view.
function pixelOf(point) {
  const g = window.google.maps
  const proj = map.getProjection()
  const b = map.getBounds()
  if (!proj || !b) return null
  const scale = 2 ** map.getZoom()
  const p = proj.fromLatLngToPoint(new g.LatLng(point))
  const nw = proj.fromLatLngToPoint(new g.LatLng(b.getNorthEast().lat(), b.getSouthWest().lng()))
  return { x: (p.x - nw.x) * scale, y: (p.y - nw.y) * scale }
}

// Is the point in the part of the map NOT covered by the panel or sheet?
function inView(point) {
  const px = pixelOf(point)
  if (!px || !el.value) return false
  const i = props.inset
  return px.x >= i.left && px.x <= el.value.clientWidth - i.right && px.y >= i.top && px.y <= el.value.clientHeight - i.bottom
}

// Centre a point in the VISIBLE part of the map: panTo puts it at the map's centre, panBy shifts it by half the covered edges.
function centreOn(point) {
  const i = props.inset
  map.panTo(point)
  map.panBy((i.right - i.left) / 2, (i.bottom - i.top) / 2)
}

// A doctor was picked → move only if its pin is hidden (off-screen or under the panel); the rep's zoom is never taken from them.
watch(
  () => props.focus,
  (f) => {
    if (!map || !f || f.lat == null || f.lng == null) return
    if (!inView(f)) centreOn(f)
  },
)

// Recenter on the rep's own location (the crosshair control in the page).
function recenter() {
  if (!map || !props.here) return
  centreOn(props.here)
  // Zoom to what the reading supports: framing a 3 km fix at street level draws a precision it does not have.
  const doubt = Number(props.accuracy) || 0
  map.setZoom(doubt > 1000 ? 12 : doubt > 200 ? 14 : 16)
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
/* A My day stop: the same red dot, grown to hold its number, like a cluster holds its count. */
.tatva-doctor-pin.is-numbered {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--surface-white);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
/* The marker is the hit box and the anchor; the dot and its label hang off it. */
.tatva-doctor-marker {
  position: relative;
}
/* A name, not a pill of data: shown at street zoom, and always on the selected pin. */
.tatva-doctor-label {
  display: none;
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 4px;
  max-width: 160px;
  padding: 2px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-gray-9);
  background: var(--surface-white);
  border-radius: 9999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.tatva-map-labelled .tatva-doctor-label,
.tatva-doctor-marker.is-selected .tatva-doctor-label {
  display: block;
}
/* The hover card sits above its pin; the padding is the bridge the pointer crosses into it. */
.tatva-peek {
  padding-bottom: 22px;
  cursor: default;
}
/* C4: the selected doctor, the same idea the panel expresses on the card — this one, not the others. */
.tatva-doctor-marker.is-selected .tatva-doctor-pin {
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
