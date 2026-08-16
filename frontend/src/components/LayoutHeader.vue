<template>
  <Teleport v-if="showHeader" to="#app-header">
    <slot>
      <header
        class="flex h-10.5 items-center justify-between py-[7px] sm:pl-5 pl-2"
      >
        <div class="flex items-center gap-2">
          <slot name="left-header" />
        </div>
        <div class="flex items-center gap-2">
          <!-- TATVA: search, immediately left of the page's own actions. Mobile only — desktop has the sidebar link and ⌘K. Not on NearMe, whose header is a map strip. -->
          <Button
            v-if="isMobileView && route.name !== 'NearMe'"
            variant="ghost"
            icon="search"
            @click="showGlobalSearch = true"
          />
          <slot name="right-header" class="flex items-center gap-2" />
        </div>
      </header>
    </slot>
  </Teleport>
</template>
<script setup>
import { isMobileView, showGlobalSearch } from '@/composables/settings'
import { ref, nextTick } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const showHeader = ref(false)

nextTick(() => {
  showHeader.value = true
})
</script>
