import { computed, ref, watch } from 'vue'
import { createResource, dayjs } from 'frappe-ui'
import { metresBetween, MOVED_M } from '@/composables/useDeviceLocation'

// TATVA: Near Me's My day — one day's plan, fetched on open or a day/rep change and again only after a real move (C.3).
export function useMyDay({ device, active }) {
  const planDate = ref(dayjs().format('YYYY-MM-DD'))
  // Whose day: '' is the viewer's own; a manager may pick a rep from their team (the server decides who that is).
  const rep = ref('')
  const dayOrigin = ref(null)
  const day = createResource({
    url: 'tatva_connect.near_me.api.my_day',
    makeParams: () => ({
      lat: dayOrigin.value.lat,
      lng: dayOrigin.value.lng,
      date: planDate.value,
      user: rep.value || undefined,
    }),
  })
  // The picker's reps, asked once when the tab first opens; empty for anyone who is not a manager.
  const team = createResource({ url: 'tatva_connect.near_me.api.my_team' })

  // The reply answers the day and the rep on screen — never a late one for a day or rep the viewer has left.
  const isShown = (d) =>
    d?.date === planDate.value && (rep.value ? d.user === rep.value : d.is_mine)

  function loadDay() {
    if (!active.value || !device.value) return
    if (!team.fetched && !team.loading) team.fetch()
    if (
      isShown(day.data) &&
      metresBetween(dayOrigin.value, device.value) < MOVED_M
    )
      return
    dayOrigin.value = { ...device.value }
    day.reload()
  }
  watch([active, planDate, rep], loadDay)

  const dayView = computed(() => (isShown(day.data) ? day.data : null))
  const dayError = computed(() =>
    day.error ? day.error.messages?.[0] || __('Try again in a moment.') : '',
  )
  const dayStops = computed(() => dayView.value?.stops || [])
  // The day's pins: the stops still to make, then the doctors already completed, which the route leaves out.
  const dayPins = computed(() => [
    ...dayStops.value,
    ...(dayView.value?.completed || []),
  ])
  // Google's road path when it ordered the day, else straight between the stops (from here, on the viewer's own today).
  const dayRoute = computed(() => {
    const d = dayView.value
    if (!d?.stops?.length) return null
    if (d.polyline) return { encoded: d.polyline }
    const points = d.stops.map((s) => ({ lat: s.lat, lng: s.lng }))
    return {
      points:
        d.is_today && d.is_mine && dayOrigin.value
          ? [dayOrigin.value, ...points]
          : points,
    }
  })

  return {
    planDate,
    rep,
    team,
    day,
    loadDay,
    dayView,
    dayError,
    dayStops,
    dayPins,
    dayRoute,
  }
}
