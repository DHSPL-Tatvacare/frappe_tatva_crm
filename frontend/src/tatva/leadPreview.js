// TATVA: the per-lead memo behind the hover card. One shape, copied from `tatva/linkTitle.js` — a
// module-level reactive map keyed by the THING plus an in-flight Map, so N hovers of one lead make one
// request and the rest await it.
//
// It is deliberately NOT a frappe-ui `cache:` key. A cached resource calls `saveLocal(cacheKey, data)`
// on EVERY success (`frappe-ui/src/resources/resources.js:104` -> `resources/local.ts`), which writes to
// IndexedDB with no TTL, no eviction and no size cap. A per-lead key would therefore persist one entry
// of patient data to the reader's disk for every lead ever hovered, permanently. Every `cache:` key in
// this app is config or master data; none is per-record, and that is not an accident.
//
// This map lives in memory, dies with the tab, and is never written anywhere.
import { reactive } from 'vue'
import { call } from 'frappe-ui'

export const leadPreviews = reactive({})
const inFlight = new Map()

// Whatever is known NOW — never a fetch, so a card can paint on its first frame with no side effect.
export function knownLeadPreview(lead) {
  if (!lead) return null
  return leadPreviews[lead] || null
}

// Ask once per lead and remember the answer. The server decides which fields come back; this asks.
export function ensureLeadPreview(lead) {
  if (!lead) return Promise.resolve(null)
  if (leadPreviews[lead]) return Promise.resolve(leadPreviews[lead])
  if (inFlight.has(lead)) return inFlight.get(lead)

  const request = call(
    'tatva_connect.api.lead_preview.get_lead_preview',
    { name: lead },
    // Explicit no-op: an omitted handler is silent only by accident of this app's config, and a preview
    // is decoration — a refused or failed read must surface as nothing at all.
    { onError: () => {} },
  )
    // The payload is ONE object (name, phone, stage, owner, source, grain), not a list of fields — the
    // card is a closed set of six things, so a truthy object is the whole of the success test.
    .then((card) => {
      if (card && typeof card === 'object') leadPreviews[lead] = card
      return leadPreviews[lead] || null
    })
    // A failure is never stored: a transient error that stuck would blank the card for the whole
    // session. Same rule and same shape as `linkTitle.js`, so there is one error policy, not two.
    .catch(() => null)
    .finally(() => inFlight.delete(lead))

  inFlight.set(lead, request)
  return request
}
