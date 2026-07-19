<template>
  <FrappeUIProvider>
    <NotPermitted v-if="$route.name === 'Not Permitted'" />
    <Layout v-else-if="session.isLoggedIn" class="isolate">
      <router-view :key="$route.fullPath" />
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
import { computed, defineAsyncComponent, provide, onMounted } from 'vue'
// TATVA: register browser/PWA push for the logged-in rep (no-op until CRM Push Settings is set).
import { initTatvaPush } from '@/tatva/push'
// TATVA: presence heartbeat + in-app notification toast (the presence-routed live surface).
import { startTatvaPresence } from '@/tatva/presence'
import { startTatvaNotify } from '@/tatva/notify'
// TATVA: queued WhatsApp history refresh — progress + completion toast that survive navigation.
import { startTatvaWhatsAppRefresh } from '@/tatva/whatsappRefresh'
import { globalStore } from '@/stores/global'

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

const MobileLayout = defineAsyncComponent(
  () => import('./components/Layouts/MobileLayout.vue'),
)
const DesktopLayout = defineAsyncComponent(
  () => import('./components/Layouts/DesktopLayout.vue'),
)
const Layout = computed(() => {
  if (window.innerWidth < 640) {
    return MobileLayout
  } else {
    return DesktopLayout
  }
})

setConfig('systemTimezone', window.timezone?.system || null)
setConfig('localTimezone', window.timezone?.user || null)
setConfig('translatedMessages', window.translated_messages || {})
</script>
