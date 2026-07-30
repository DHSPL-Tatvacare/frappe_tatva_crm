import { computed, ref } from 'vue'
import { useWindowSize } from '@vueuse/core'

export const mobileSidebarOpened = ref(false)

// TATVA: through a REACTIVE width. `window.innerWidth` is not reactive, so this computed was evaluated once and cached for the tab's life — a rotation or a resize kept whatever layout the first read saw until a hard reload.
const { width: windowWidth } = useWindowSize()
export const isMobileView = computed(() => windowWidth.value < 768)

// TATVA: installed-PWA detection — the ONE home for it (a page-local `pointer: coarse` copy once sent
// every touchscreen laptop to the phone dialer). Display-mode is fixed for the tab's life, so a plain
// const is correct where width is not.
export const isStandalonePWA =
  typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches

export const showSettings = ref(false)

// TATVA: global spotlight (⌘K) visibility — one shared ref, mirroring showSettings. The sidebar link
// and the ⌘K shortcut flip it; GlobalSearch.vue binds it with v-model.
export const showGlobalSearch = ref(false)

export const disableSettingModalOutsideClick = ref(false)

export const activeSettingsPage = ref('')
