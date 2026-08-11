<template>
  <!-- dvh, not vh: `100vh` on a phone is the viewport with the URL bar RETRACTED, so a shell sized to it hangs below what you can see and the footer pinned to its bottom edge is unreachable. `100dvh` tracks the visible area as the bar moves. -->
  <div class="flex h-[100dvh] w-full">
    <MobileSidebar />
    <!-- The bottom inset keeps the last row clear of the iOS home indicator, once, for every page in the slot. -->
    <div
      class="flex h-full flex-1 flex-col overflow-auto bg-surface-white pb-[env(safe-area-inset-bottom)]"
    >
      <MobileAppHeader />
      <slot />
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
