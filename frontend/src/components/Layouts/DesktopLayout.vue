<template>
  <!-- dvh matches vh on a desktop, and on an iPad — which lands here at >=768px — it tracks the collapsing chrome the same way the mobile shell does. -->
  <div class="flex h-[100dvh] w-full">
    <div class="h-full border-r bg-surface-menu-bar">
      <AppSidebar />
    </div>
    <div class="flex-1 flex flex-col h-full overflow-auto bg-surface-white">
      <AppHeader />
      <slot />
    </div>
    <GlobalModals />
  </div>
</template>
<script setup>
import AppSidebar from '@/components/Layouts/AppSidebar.vue'
import AppHeader from '@/components/Layouts/AppHeader.vue'
import GlobalModals from '@/components/Modals/GlobalModals.vue'
</script>
