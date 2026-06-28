// TATVA: the ONE switch for mobile bottom-sheet modals. Ships DORMANT — default OFF (invariant 6: a
// blank/unset switch reads as disabled), so every adopted modal stays a stock centered Dialog until an
// operator flips this on. ResponsiveDialog reads `bottomSheetEnabled` to decide sheet-vs-dialog (a
// sheet only when this is ON *and* the viewport is mobile).
//
// HOW TO ENABLE (two ways, both persist to localStorage):
//   • Mobile-friendly (no devtools): append ?bottomsheet=1 to any CRM URL once (?bottomsheet=0 to
//     turn off). Works on a phone where the console is out of reach.
//   • Console/desktop: localStorage.setItem('tatva:bottomSheetModals','1') then reload.
// Prod can later hydrate this from a server setting. Toggling instantly enables/reverts every modal.
import { ref } from 'vue'

const STORAGE_KEY = 'tatva:bottomSheetModals'

// Accept the override anywhere in the URL (search OR hash query — the SPA puts tab state in the hash).
function urlOverride() {
  if (typeof window === 'undefined') return null
  const m = window.location.href.match(/[?&#]bottomsheet=([01])\b/)
  return m ? m[1] : null
}

function readInitial() {
  if (typeof window === 'undefined') return false
  const o = urlOverride()
  if (o !== null) {
    const on = o === '1'
    try {
      if (on) localStorage.setItem(STORAGE_KEY, '1')
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* private mode / storage disabled — fall through to the in-memory value */
    }
    return on
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const bottomSheetEnabled = ref(readInitial())

export function setBottomSheetEnabled(on) {
  bottomSheetEnabled.value = !!on
  if (typeof localStorage === 'undefined') return
  if (on) localStorage.setItem(STORAGE_KEY, '1')
  else localStorage.removeItem(STORAGE_KEY)
}
