<template>
  <!-- dvh, not vh: `100vh` on a phone is the viewport with the URL bar RETRACTED, so a shell sized to it hangs below what you can see and the footer pinned to its bottom edge is unreachable. `100dvh` tracks the visible area as the bar moves. -->
  <div class="flex h-[100dvh] w-screen">
    <MobileSidebar />
    <!-- `min-h-0`: a flex child defaults to `min-height:auto` and REFUSES to shrink below its content, so this column outgrew the shell and the page scrolled the chrome away. -->
    <div class="flex h-full min-h-0 flex-1 flex-col bg-surface-white">
      <!-- Chrome, never inside the scroller — a header that scrolls is a header the reader loses. -->
      <div class="shrink-0">
        <MobileAppHeader />
      </div>
      <!-- The one scroller, and the bottom inset rides with it so the last row clears the iOS home indicator instead of banding white above the browser bar. -->
      <div
        class="flex min-h-0 flex-1 flex-col overflow-auto pb-[env(safe-area-inset-bottom)]"
      >
        <slot />
      </div>
    </div>
    <GlobalModals />
    <!-- TATVA: the mobile counterpart of AppSidebar's <Settings>. Mounted here, not in MobileSidebar, whose subtree unmounts with the drawer. -->
    <SettingsSheet />
  </div>
</template>
<script setup>
import MobileSidebar from '@/components/Mobile/MobileSidebar.vue'
import MobileAppHeader from '@/components/Mobile/MobileAppHeader.vue'
import GlobalModals from '@/components/Modals/GlobalModals.vue'
import SettingsSheet from '@/tatva/SettingsSheet.vue'
</script>
