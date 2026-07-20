<template>
  <component
    :is="props.as || 'div'"
    ref="scrollableDiv"
    :style="`maskImage: ${maskStyle}`"
    @scroll="updateMaskStyle"
  >
    <slot></slot>
  </component>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  as: { type: String, default: 'div' },
  maskLength: { type: Number, default: 30 },
  orientation: { type: String, default: 'vertical' },
})

const scrollableDiv = ref(null)
const maskStyle = ref('none')
const side = computed(() =>
  props.orientation == 'horizontal' ? 'right' : 'bottom',
)

function updateMaskStyle() {
  if (!scrollableDiv.value) return

  let scrollWidth = scrollableDiv.value.scrollWidth
  let clientWidth = scrollableDiv.value.clientWidth
  let scrollHeight = scrollableDiv.value.scrollHeight
  let clientHeight = scrollableDiv.value.clientHeight
  let scrollTop = scrollableDiv.value.scrollTop
  let scrollLeft = scrollableDiv.value.scrollLeft

  maskStyle.value = 'none'

  // faded on both sides
  if (
    (side.value == 'right' && scrollWidth > clientWidth) ||
    (side.value == 'bottom' && scrollHeight > clientHeight)
  ) {
    maskStyle.value = `linear-gradient(to ${side.value}, transparent, black ${props.maskLength}px, black calc(100% - ${props.maskLength}px), transparent);`
  }

  // faded on left or top
  if (
    (side.value == 'right' && scrollLeft - 20 > clientWidth) ||
    (side.value == 'bottom' && scrollTop + clientHeight >= scrollHeight)
  ) {
    maskStyle.value = `linear-gradient(to ${side.value}, transparent, black ${props.maskLength}px, black 100%, transparent);`
  }

  // faded on right or bottom
  if (
    (side.value == 'right' && scrollLeft == 0) ||
    (side.value == 'bottom' && scrollTop == 0)
  ) {
    maskStyle.value = `linear-gradient(to ${side.value}, black calc(100% - ${props.maskLength}px), transparent 100%);`
  }

  if (
    (side.value == 'right' && clientWidth == scrollWidth) ||
    (side.value == 'bottom' && clientHeight == scrollHeight)
  ) {
    maskStyle.value = 'none'
  }
}

onMounted(() => setTimeout(() => updateMaskStyle(), 300))

// A list you ADD rows to did not overflow at mount, so a scroll-only recompute leaves the fade off and the
// content reads as sliced. The scroller's own box never changes here (it is fixed-height, the content grows
// inside it), so watch the CONTENT for changes rather than the element for resizes.
let observer = null
onMounted(() => {
  if (!scrollableDiv.value || typeof MutationObserver === 'undefined') return
  observer = new MutationObserver(() => updateMaskStyle())
  observer.observe(scrollableDiv.value, { childList: true, subtree: true, characterData: true })
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<style scoped>
div {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
div::-webkit-scrollbar {
  display: none;
}
</style>
