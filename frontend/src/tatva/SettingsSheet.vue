<!-- TATVA: SettingsSheet — Settings on the PWA. Only the settings SHELL is desktop-bound (a 5xl Dialog around a fixed w-56 rail); every PANEL is already self-contained and width-agnostic, so this reuses them verbatim behind a mobile shell and rewrites nothing. Binds the SAME showSettings ref as the desktop modal: one state, two renderers, picked by layout (DesktopLayout -> AppSidebar -> Settings.vue; MobileLayout -> this), so no isMobileView gate is needed. Exposes exactly the "User Configuration" group — the one group with no isManager() gate: on mobile you get YOUR settings, the system's stay at a desk. Lifecycle mirrors Settings.vue: `<component :is>` behind a v-if, so only the OPEN panel mounts and the list itself costs zero calls. -->
<template>
  <TatvaBottomSheet v-model="open">
    <template #header>
      <button
        v-if="active"
        type="button"
        class="-ml-1 flex items-center gap-1 rounded py-0.5 pl-1 pr-2 text-ink-gray-9 active:bg-surface-gray-2"
        @click="active = ''"
      >
        <FeatherIcon name="chevron-left" class="h-4 w-4 shrink-0" />
        <span class="text-base font-semibold">{{ __('Settings') }}</span>
      </button>
      <span v-else class="text-base font-semibold text-ink-gray-9">
        {{ __('Settings') }}
      </span>
    </template>

    <ul v-if="!active" class="flex flex-col">
      <li v-for="panel in panels" :key="panel.key">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left active:bg-surface-gray-2"
          @click="active = panel.key"
        >
          <Icon :icon="panel.icon" class="h-4 w-4 shrink-0 text-ink-gray-7" />
          <span class="min-w-0 flex-1 truncate text-base text-ink-gray-8">
            {{ panel.label }}
          </span>
          <FeatherIcon
            name="chevron-right"
            class="h-4 w-4 shrink-0 text-ink-gray-5"
          />
        </button>
      </li>
    </ul>

    <!-- Only the open panel mounts — the same lazy contract as Settings.vue's own content pane. -->
    <component :is="activeComponent" v-else />
  </TatvaBottomSheet>
</template>

<script setup>
import { computed, h, markRaw, ref, watch } from 'vue'
import { Avatar, FeatherIcon } from 'frappe-ui'
import BellIcon from '~icons/lucide/bell'
import Icon from '@/components/Icon.vue'
import SlidersIcon from '@/components/Icons/SlidersIcon.vue'
import PreferencesSettings from '@/components/Settings/PreferencesSettings.vue'
import ProfilePage from '@/components/Settings/Profile/ProfilePage.vue'
import TatvaBottomSheet from '@/tatva/TatvaBottomSheet.vue'
import NotificationsSettings from '@/tatva/NotificationsSettings.vue'
import {
  showSettings,
  activeSettingsPage,
  mobileSidebarOpened,
} from '@/composables/settings'
import { usersStore } from '@/stores/users'

const { getUser } = usersStore()
const user = computed(() => getUser() || {})

// Bound to the SAME ref the desktop modal uses, so the dropdown's one onClick drives both surfaces.
const open = showSettings
const active = ref('')

// Labels match Settings.vue's, so an activeSettingsPage deep-link resolves against the same names.
const panels = computed(() => [
  {
    key: 'profile',
    label: __('Profile'),
    icon: () =>
      h(Avatar, {
        size: 'xs',
        label: user.value.full_name,
        image: user.value.user_image,
      }),
    component: markRaw(ProfilePage),
  },
  {
    key: 'preferences',
    label: __('Preferences'),
    icon: SlidersIcon,
    component: markRaw(PreferencesSettings),
  },
  {
    key: 'notifications',
    label: __('Notifications'),
    icon: BellIcon,
    component: markRaw(NotificationsSettings),
  },
])

const activeComponent = computed(
  () => panels.value.find((p) => p.key === active.value)?.component,
)

// immediate: a sheet can mount already open (UI rule 23). A deep-link is honoured only when it names a panel we expose — a desktop-only one (Templates) falls back to the list, not an empty sheet.
watch(
  open,
  (isOpen) => {
    if (isOpen) {
      // The drawer is a headlessui Dialog — stacked, the two modals fight over the body scroll-lock and the focus trap, and closing the sheet clears the drawer's lock.
      mobileSidebarOpened.value = false
      const target = panels.value.find((p) => p.label === activeSettingsPage.value)
      active.value = target?.key || ''
      return
    }
    active.value = ''
    activeSettingsPage.value = ''
  },
  { immediate: true },
)
</script>
