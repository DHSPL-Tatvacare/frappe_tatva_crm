// TATVA: the per-lead memo behind the hover card — in memory only, never a frappe-ui `cache:` key, which would persist patient data to IndexedDB.
import { reactive } from 'vue'
import { call } from 'frappe-ui'

// Each lead's settled answer: `{ card }`, or `{ refusal }` when the server said it does not exist or may not be read.
export const leadPreviews = reactive({})
const inFlight = new Map()

// The framework's own exception names for a DEFINITIVE answer; anything else is transient and asked again.
const REFUSALS = { DoesNotExistError: 'missing', PermissionError: 'forbidden' }

// Whatever is known NOW — never a fetch, so a card can paint on its first frame with no side effect.
export function knownLeadPreview(lead) {
  if (!lead) return null
  return leadPreviews[lead] || null
}

// Ask once per lead and remember the answer; N hovers of one lead in flight share one request.
export function ensureLeadPreview(lead) {
  if (!lead) return Promise.resolve(null)
  if (leadPreviews[lead]) return Promise.resolve(leadPreviews[lead])
  if (inFlight.has(lead)) return inFlight.get(lead)

  const request = call('tatva_connect.api.lead_preview.get_lead_preview', { name: lead })
    // A card is only an answer when it carries rows; anything else is not remembered and reads as unavailable.
    .then((card) => {
      if (card?.rows?.length) leadPreviews[lead] = { card }
      return leadPreviews[lead] || null
    })
    // A refusal is an answer and is remembered for the session, as `linkTitle.js` remembers "not found"; a transient failure is not.
    .catch((e) => {
      const refusal = REFUSALS[e?.exc_type]
      if (refusal) leadPreviews[lead] = { refusal }
      return leadPreviews[lead] || null
    })
    .finally(() => inFlight.delete(lead))

  inFlight.set(lead, request)
  return request
}
