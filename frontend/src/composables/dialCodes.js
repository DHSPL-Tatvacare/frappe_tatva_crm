// The country dial codes a phone input offers. Mirrors composables/mapConfig.js: ONE module-level
// resource, resolved once, shared by every surface — never one per component instance.
//
// The list is identical for every user and does not change while a tab is open, so a phone field on a
// lead form, a contact form and a modal all read the same fetch. The server caches it per site
// (whatsapp.phone.dial_codes, @redis_cache), so even the first fetch is a Redis read.
//
// The names are Frappe's own `Country` table and the codes are libphonenumber's; nothing here holds a
// country list.
import { createResource } from 'frappe-ui'

const codes = createResource({
  url: 'tatva_connect.whatsapp.phone.dial_codes',
  cache: 'tatva-dial-codes',
  initialData: [],
})

// Lazy, like useMapConfig: the first phone field that actually renders triggers the single fetch, and a
// screen with no phone field never causes one.
export function useDialCodes() {
  if (!codes.data?.length && !codes.loading) codes.fetch()
  return codes
}
