<template>
  <!-- dvh matches vh on a desktop, and on an iPad — which lands here at >=768px — it tracks the collapsing chrome the same way the mobile shell does. -->
  <div class="flex h-[100dvh] w-screen">
    <div class="h-full border-r bg-surface-menu-bar">
      <AppSidebar />
    </div>
    <!-- Same shape as MobileLayout: `min-h-0` so this column cannot outgrow the shell, chrome pinned outside the scroller, one scroller around the slot. -->
    <div class="flex h-full min-h-0 flex-1 flex-col bg-surface-white">
      <div class="shrink-0">
        <AppHeader />
      </div>
      <div class="flex min-h-0 flex-1 flex-col overflow-auto">
        <slot />
      </div>
    </div>
    <GlobalModals />
  </div>
</template>
<script setup>
import AppSidebar from '@/components/Layouts/AppSidebar.vue'
import AppHeader from '@/components/Layouts/AppHeader.vue'
import GlobalModals from '@/components/Modals/GlobalModals.vue'
</script>
