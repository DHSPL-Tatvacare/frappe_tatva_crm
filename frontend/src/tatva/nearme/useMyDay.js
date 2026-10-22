import { computed, ref, watch } from 'vue'
import { createResource, dayjs } from 'frappe-ui'
import { metresBetween, MOVED_M } from '@/composables/useDeviceLocation'

// TATVA: Near Me's My day — one day's plan from where the rep stands, its one fetch, and the line the map draws.
// Asked when the tab opens or the day changes, and again only once the rep has genuinely moved (C.3). The server
// remembers the order per day, so a re-ask never reshuffles it or pays Google twice.
export function useMyDay({ device, active }) {
  const planDate = ref(dayjs().format('YYYY-MM-DD'))
  const dayOrigin = ref(null)
  const day = createResource({
    url: 'tatva_connect.near_me.api.my_day',
    makeParams: () => ({
      lat: dayOrigin.value.lat,
      lng: dayOrigin.value.lng,
      date: planDate.value,
    }),
  })

  function loadDay() {
    if (!active.value || !device.value) return
    const same =
      day.data?.date === planDate.value &&
      metresBetween(dayOrigin.value, device.value) < MOVED_M
    if (same) return
    dayOrigin.value = { ...device.value }
    day.reload()
  }
  watch([active, planDate], loadDay)

  // Only the reply for the day on screen is drawn, so a late answer for a day the rep has left never shows.
  const dayView = computed(() =>
    day.data?.date === planDate.value ? day.data : null,
  )
  const dayError = computed(() =>
    day.error ? day.error.messages?.[0] || __('Try again in a moment.') : '',
  )
  const dayStops = computed(() => dayView.value?.stops || [])
  // Google's road path when it ordered the day, else straight between the stops (from here, today).
  const dayRoute = computed(() => {
    const d = dayView.value
    if (!d?.stops?.length) return null
    if (d.polyline) return { encoded: d.polyline }
    const points = d.stops.map((s) => ({ lat: s.lat, lng: s.lng }))
    return {
      points:
        d.is_today && dayOrigin.value ? [dayOrigin.value, ...points] : points,
    }
  })

  return { planDate, day, loadDay, dayView, dayError, dayStops, dayRoute }
}
