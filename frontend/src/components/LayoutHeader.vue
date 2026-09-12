<template>
  <Teleport v-if="showHeader" to="#app-header">
    <slot>
      <header
        class="flex h-10.5 items-center justify-between py-[7px] sm:pl-5 pl-2"
      >
        <!-- TATVA: the page's own actions are never pushed off the screen by a long title. The left
             region may SHRINK (`min-w-0`, or a flex child refuses to go below its content width and a
             long saved-view name simply grew the header), and the actions never do (`shrink-0`). This is
             the header every list page teleports into, so it is fixed once here rather than per page. -->
        <div class="flex min-w-0 items-center gap-2">
          <slot name="left-header" />
        </div>
        <div class="flex shrink-0 items-center gap-2">
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
