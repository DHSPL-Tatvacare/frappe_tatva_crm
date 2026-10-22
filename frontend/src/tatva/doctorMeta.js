import { formatDistance } from '@/utils'
import { linkTitleFor } from '@/tatva/linkTitle'

// TATVA: the ONE wording of a Near Me doctor's distance and meta line, read by the row, the hover card and the detail panel.
export function doctorDistance(d) {
  const m = d?.distance_m
  if (m == null) return ''
  // Zero metres is a MEANING ("you are standing here"), so it is worded here; the format is shared.
  if (m < 1) return __('Here')
  return formatDistance(m)
}

// The stage's title off the territory reply's `_link_titles` (linkTitle.js, never a `::` split); the raw key only when the reader may not see the title.
export function doctorStage(d, territory) {
  return linkTitleFor(d?.stage_doctype, d?.stage, territory) || d?.stage || ''
}

// `Stage · 1.5 km`, plus the business line only when the territory spans more than one.
export function doctorMeta(d, territory, showGrain) {
  return [
    doctorStage(d, territory),
    doctorDistance(d),
    showGrain ? d?.grain : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

// The WhatsApp app's own link, from the server's stored-form number; '' when the number has none.
export function whatsappUrl(d) {
  const digits = (d?.mobile_e164 || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : ''
}

// The Google Maps app's own directions link: from here, through the stops in order, ending at the last. The app routes it.
export function routeUrl(origin, stops) {
  const at = (p) => `${p.lat},${p.lng}`
  const params = new URLSearchParams({
    api: '1',
    origin: at(origin),
    destination: at(stops[stops.length - 1]),
    travelmode: 'driving',
  })
  const through = stops.slice(0, -1)
  if (through.length) params.set('waypoints', through.map(at).join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}
