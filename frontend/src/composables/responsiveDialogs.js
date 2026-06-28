// TATVA: the ONE switch for mobile bottom-sheet modals. Ships DORMANT — default OFF (invariant 6: a
// blank/unset switch reads as disabled), so every adopted modal stays a stock centered Dialog until an
// operator flips this on. ResponsiveDialog reads `bottomSheetEnabled` to decide sheet-vs-dialog (a
// sheet only when this is ON *and* the viewport is mobile). Dev flips it via localStorage; prod can
// later hydrate it from a server setting. Toggling instantly enables/reverts every adopted modal.
import { ref } from 'vue'

const STORAGE_KEY = 'tatva:bottomSheetModals'
const stored = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1'

export const bottomSheetEnabled = ref(stored)

export function setBottomSheetEnabled(on) {
  bottomSheetEnabled.value = !!on
  if (typeof localStorage === 'undefined') return
  if (on) localStorage.setItem(STORAGE_KEY, '1')
  else localStorage.removeItem(STORAGE_KEY)
}
