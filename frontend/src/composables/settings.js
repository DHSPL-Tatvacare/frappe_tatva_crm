import { computed, ref } from 'vue'

export const mobileSidebarOpened = ref(false)

export const isMobileView = computed(() => window.innerWidth < 768)

export const showSettings = ref(false)

// TATVA: global spotlight (⌘K) visibility — one shared ref, mirroring showSettings. The sidebar link
// and the ⌘K shortcut flip it; GlobalSearch.vue binds it with v-model.
export const showGlobalSearch = ref(false)

export const disableSettingModalOutsideClick = ref(false)

export const activeSettingsPage = ref('')
