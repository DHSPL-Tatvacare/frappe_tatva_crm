<template>
  <!-- TATVA: a route with meta.hideAppHeader hides the strip with CSS, never v-if — CallUI registers makeCall and must stay mounted. -->
  <div :class="route.meta.hideAppHeader ? 'hidden' : 'flex border-b pr-5'">
    <div id="app-header" class="flex-1"></div>
    <div class="flex items-center justify-center">
      <CallUI />
    </div>
  </div>
</template>

<script setup>
import CallUI from '@/components/Telephony/CallUI.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>
