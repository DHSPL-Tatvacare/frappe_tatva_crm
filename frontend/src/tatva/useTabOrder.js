// TATVA: the one brain for a personal tab order, shared by every surface that draws the strip.
//
// The desktop rail and the mobile sheet both draw the SAME list of views and both let you drag it, so
// the save/reset call lives here rather than being written twice. It is deliberately not a component:
// there is no markup to share — each surface already has its own list and only needs the two verbs.
//
// COMMITTED ON DROP, like `ColumnSettings` (`@end="apply"`). Reordering columns in this app has never
// had a Save button, so reordering tabs must not grow one; the way back is Reset, same as there.
//
// Personal by construction: `tatva_connect.tab_order` keys on the session user through frappe's own
// `__UserSettings`, so nothing here passes a user and there is no sharing to gate.
import { call, toast } from 'frappe-ui'

export function useTabOrder(referenceDoctype) {
  async function save(order) {
    try {
      await call('tatva_connect.tab_order.save_order', {
        reference_doctype: referenceDoctype,
        order: JSON.stringify(order),
      })
      return true
    } catch (e) {
      toast.error(e?.messages?.[0] || __('Could not save this order'))
      return false
    }
  }
  return { save, reset: () => save([]) }
}
