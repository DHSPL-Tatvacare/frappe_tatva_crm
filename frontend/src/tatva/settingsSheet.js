import { inject, onBeforeUnmount, watch } from 'vue'

// TATVA: the mobile Settings sheet's ONE header and ONE back button, shared with any panel that drills deeper.
export const SETTINGS_SHEET = Symbol('settingsSheet')

// A panel's drilled screen tells the sheet its title and how to go back; blank `title` means the panel's own top. A no-op outside the sheet (desktop).
export function useSheetDrill(title, back) {
  const sheet = inject(SETTINGS_SHEET, null)
  if (!sheet) return
  watch(title, (t) => sheet.drill(t ? { title: t, back } : null), {
    immediate: true,
  })
  onBeforeUnmount(() => sheet.drill(null))
}
