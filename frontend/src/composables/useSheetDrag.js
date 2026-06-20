import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// TATVA: the ONE draggable-bottom-sheet engine, shared by NearMe (a resize panel) and Smart Views
// (a dismissible picker) so neither hardcodes its own drag. Pointer-drag with snap points + BODY
// SCROLL LOCK (so the page behind never scrolls while you drag — the bug we hit) + narrow-viewport
// detection. On mobile the sheet height is a fraction of the viewport; on desktop `sheetStyle` is
// empty so CSS (md: classes) controls the layout. Set `dismissible` for a modal that closes when
// dragged below `min` (then the consumer owns the open/close lock); otherwise it snaps collapsed↔expanded.
export function useSheetDrag(opts = {}) {
  const collapsed = opts.collapsed ?? 0.45
  const expanded = opts.expanded ?? 0.85
  const min = opts.min ?? 0.16
  const dismissible = opts.dismissible ?? false
  const onDismiss = opts.onDismiss

  const sheetFrac = ref(collapsed)
  const isDragging = ref(false)
  const isNarrow = ref(false)
  let mql = null
  let dragStartY = 0
  let dragStartFrac = collapsed

  function lockBody(on) {
    if (typeof document !== 'undefined') document.body.style.overflow = on ? 'hidden' : ''
  }
  function onMqChange(e) {
    isNarrow.value = e.matches
  }
  function onDragStart(e) {
    isDragging.value = true
    dragStartY = e.clientY
    dragStartFrac = sheetFrac.value
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (!dismissible) lockBody(true) // a modal is already locked while open
  }
  function onDragMove(e) {
    if (!isDragging.value) return
    const dy = e.clientY - dragStartY
    const vh = window.innerHeight || 1
    const floor = dismissible ? 0 : min
    sheetFrac.value = Math.min(expanded, Math.max(floor, dragStartFrac - dy / vh))
  }
  function onDragEnd() {
    if (!isDragging.value) return
    isDragging.value = false
    if (dismissible && sheetFrac.value < min) {
      onDismiss?.() // dragged far enough down → close; consumer clears the lock
      return
    }
    sheetFrac.value = sheetFrac.value >= (collapsed + expanded) / 2 ? expanded : collapsed
    if (!dismissible) lockBody(false)
  }
  const sheetStyle = computed(() =>
    isNarrow.value
      ? {
          height: `${(sheetFrac.value * 100).toFixed(1)}vh`,
          transition: isDragging.value ? 'none' : 'height 0.2s ease',
        }
      : {},
  )

  onMounted(() => {
    mql = window.matchMedia('(max-width: 767px)')
    isNarrow.value = mql.matches
    mql.addEventListener('change', onMqChange)
  })
  onBeforeUnmount(() => {
    if (mql) mql.removeEventListener('change', onMqChange)
    lockBody(false)
  })

  function reset() {
    sheetFrac.value = collapsed
  }

  return {
    sheetFrac,
    isDragging,
    isNarrow,
    sheetStyle,
    onDragStart,
    onDragMove,
    onDragEnd,
    lockBody,
    reset,
  }
}
