<template>
  <FrappeUIProvider>
    <NotPermitted v-if="$route.name === 'Not Permitted'" />
    <Layout v-else-if="session.isLoggedIn" class="isolate">
      <!-- TATVA: `path` not `fullPath` — a tab is a #hash, and keying on it rebuilt the whole record page (side panel, stages, 7 link lookups) on every tab switch. -->
      <router-view :key="$route.path" />
    </Layout>
    <Dialogs />
    <DoctypeModals />
  </FrappeUIProvider>
</template>

<script setup>
import NotPermitted from '@/pages/NotPermitted.vue'
import DoctypeModals from '@/components/Modals/DoctypeModals.vue'
import { Dialogs } from '@/utils/dialogs'
import { sessionStore } from '@/stores/session'
import { FrappeUIProvider, setConfig, useTheme } from 'frappe-ui'
import { defineAsyncComponent, provide, onMounted } from 'vue'
// TATVA: register browser/PWA push for the logged-in rep (no-op until CRM Push Settings is set).
import { initTatvaPush } from '@/tatva/push'
// TATVA: presence heartbeat + in-app notification toast (the presence-routed live surface).
import { startTatvaPresence } from '@/tatva/presence'
import { startTatvaNotify } from '@/tatva/notify'
// TATVA: queued WhatsApp history refresh — progress + completion toast that survive navigation.
import { startTatvaWhatsAppRefresh } from '@/tatva/whatsappRefresh'
import { globalStore } from '@/stores/global'
// TATVA: <meta name="theme-color"> follows the theme — see tatva/themeColor.js.
import { startThemeColorSync } from '@/tatva/themeColor'
import { isMobileView } from '@/composables/settings'

const session = sessionStore()
provide('session', session)

// TATVA: once per authenticated rep — register push, start presence, and attach the toast
// handler to the existing CRM socket (one touchpoint; all logic lives in tatva_connect).
onMounted(() => {
  if (!session.isLoggedIn) return
  initTatvaPush()
  const { $socket } = globalStore()
  startTatvaPresence($socket)
  startTatvaNotify($socket)
  startTatvaWhatsAppRefresh($socket)
})

const { setTheme } = useTheme()
if (!localStorage.getItem('theme')) {
  setTheme('light')
}
startThemeColorSync()

const MobileLayout = defineAsyncComponent(
  () => import('./components/Layouts/MobileLayout.vue'),
)
const DesktopLayout = defineAsyncComponent(
  () => import('./components/Layouts/DesktopLayout.vue'),
)
// TATVA: one threshold, read from the shared `isMobileView` (768) — at 640 the shell and the pages disagreed and 640-767px got DesktopLayout wrapping the Mobile* pages. Read ONCE, deliberately: <Layout> wraps <router-view>, so tracking the width would unmount and rebuild every page, resource and open modal the moment a rotation crossed the breakpoint.
const Layout = isMobileView.value ? MobileLayout : DesktopLayout

setConfig('systemTimezone', window.timezone?.system || null)
setConfig('localTimezone', window.timezone?.user || null)
setConfig('translatedMessages', window.translated_messages || {})
</script>
