<template>
  <div class="flex h-screen w-screen">
    <MobileSidebar />
    <div class="flex h-full flex-1 flex-col overflow-auto bg-surface-white">
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
