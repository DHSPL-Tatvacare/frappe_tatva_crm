// useDeviceLocation — the one place Near Me asks this device where it is.
// The first fix paints at once, then the browser is kept listening until the reading is accurate enough.
import { ref, onScopeDispose } from 'vue'

// Looser than this is an AREA, not a point: it wears a halo, and its address is labelled approximate.
export const COARSE_M = 500
// Accurate enough — stop listening.
const GOOD_M = 50
// How long we keep listening for something better before settling for what we have.
const REFINE_MS = 20000
// maximumAge 0 is not a preference: a cached reading is returned BEFORE any provider runs, so a coarse
// Wi-Fi fix left by another tab beats the GPS this device is already holding.
const OPTIONS = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
const EARTH_M = 6371000
// Geolocation's own codes are 1/2/3; 0 is ours, for a browser with no geolocation at all.
const UNSUPPORTED = 0

// Metres between two { lat, lng } — answers "did the sharpened reading move the search?" without a call.
export function metresBetween(a, b) {
  if (!a || !b) return Infinity
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// A function, not a const: `__` is installed by the translation plugin, after this module is evaluated.
export const blockedMessage = () =>
  __('Location is blocked for this site. Allow it in your browser settings, then try again.')

// Four failures, four instructions — a GPS timeout must never read as a permission the rep never revoked.
function errorMessage(err) {
  if (err?.code === 1) return blockedMessage()
  if (err?.code === 3) return __('Getting your location took too long. Try again.')
  if (err?.code === UNSUPPORTED) return __('This device cannot report a location.')
  return __('Your location could not be determined. Try again.')
}

function read(position) {
  const { latitude, longitude, accuracy } = position.coords
  return { lat: latitude, lng: longitude, accuracy }
}

function once() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: { code: UNSUPPORTED } })
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: read(p) }),
      (error) => resolve({ error }),
      OPTIONS,
    )
  })
}

// 'granted' is the only state that can be read without a prompt. Safari throws on the name, hence 'unknown'.
export async function locationPermission() {
  try {
    if (!navigator.permissions?.query) return 'unknown'
    return (await navigator.permissions.query({ name: 'geolocation' })).state
  } catch {
    return 'unknown'
  }
}

export function useDeviceLocation() {
  const coords = ref(null) // { lat, lng } — ready to hand straight to a map
  const accuracy = ref(0) // metres; 0 until something has been read
  const status = ref('idle') // idle | locating | refining | ready | error
  const message = ref('')

  let watcher = null
  let timer = null
  // A reading in flight cannot be cancelled, so a slow answer is discarded rather than left to overwrite.
  let generation = 0

  function stop() {
    if (watcher != null) navigator.geolocation.clearWatch(watcher)
    if (timer) clearTimeout(timer)
    watcher = null
    timer = null
  }

  function settle() {
    stop()
    status.value = 'ready'
  }

  // A sharper reading replaces a looser one; a looser one never undoes progress.
  function accept(next) {
    if (coords.value && next.accuracy > accuracy.value) return
    coords.value = { lat: next.lat, lng: next.lng }
    accuracy.value = next.accuracy
  }

  // A failed refinement means nothing better is coming, so we stop rather than burn the rep's battery.
  function refine() {
    status.value = 'refining'
    watcher = navigator.geolocation.watchPosition(
      (p) => {
        accept(read(p))
        if (accuracy.value <= GOOD_M) settle()
      },
      settle,
      OPTIONS,
    )
    timer = setTimeout(settle, REFINE_MS)
  }

  // Resolves with the FIRST fix so the caller paints immediately; better ones arrive via coords/status.
  async function locate() {
    stop()
    const mine = ++generation
    status.value = 'locating'
    message.value = __('Getting your location…')
    const { coords: first, error } = await once()
    if (mine !== generation) return null // overtaken — the newer read owns the state now
    if (error) {
      status.value = 'error'
      message.value = errorMessage(error)
      return null
    }
    coords.value = null // a new read replaces the old reading outright, never merges with it
    accuracy.value = 0
    accept(first)
    message.value = ''
    if (accuracy.value <= GOOD_M) status.value = 'ready'
    else refine()
    return coords.value
  }

  onScopeDispose(stop)

  return { coords, accuracy, status, message, locate }
}
