import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// TATVA: the ONE draggable-bottom-sheet engine. Two modes, one engine:
//   • 'snap' (default) — a resizable panel that snaps collapsed↔expanded by viewport fraction (NearMe,
//     Smart Views picker). `dismissible` lets it close when dragged below `min`. Drives `height`.
//   • 'fit' — a CONTENT-SIZED modal sheet: no fixed height (the consumer caps it with `max-height` so it
//     wraps its content — no dead space below short content). Drag DOWN translates the sheet (GPU
//     transform, not height) and releases past `dismissPx` to dismiss; otherwise it springs back.
// Both lock the page scroll while open and only engage on a narrow viewport (desktop → empty style).
export function useSheetDrag(opts = {}) {
  const mode = opts.mode ?? 'snap'
  const collapsed = opts.collapsed ?? 0.45
  const expanded = opts.expanded ?? 0.85
  const min = opts.min ?? 0.16
  const dismissible = opts.dismissible ?? false
  const dismissPx = opts.dismissPx ?? 110 // fit mode: drag this far down to dismiss
  const onDismiss = opts.onDismiss

  const sheetFrac = ref(collapsed) // snap mode: height as a fraction of the viewport
  const dragY = ref(0) // fit mode: downward drag offset in px (>= 0)
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
    if (mode === 'snap' && !dismissible) lockBody(true) // a modal is already locked while open
  }
  function onDragMove(e) {
    if (!isDragging.value) return
    const dy = e.clientY - dragStartY
    if (mode === 'fit') {
      dragY.value = Math.max(0, dy) // only downward; up is a no-op (content already fills upward)
      return
    }
    const vh = window.innerHeight || 1
    const floor = dismissible ? 0 : min
    sheetFrac.value = Math.min(expanded, Math.max(floor, dragStartFrac - dy / vh))
  }
  function onDragEnd() {
    if (!isDragging.value) return
    isDragging.value = false
    if (mode === 'fit') {
      // Past the threshold → close (the leave transition slides it the rest of the way out). Otherwise
      // spring back to rest. `dismissible: false` (wizards) never closes on drag — it always springs
      // back. Clearing dragY drops the inline transform so the leave class can take over.
      if (dismissible && dragY.value > dismissPx) onDismiss?.()
      dragY.value = 0
      return
    }
    if (dismissible && sheetFrac.value < min) {
      onDismiss?.() // dragged far enough down → close; consumer clears the lock
      return
    }
    sheetFrac.value = sheetFrac.value >= (collapsed + expanded) / 2 ? expanded : collapsed
    if (!dismissible) lockBody(false)
  }
  const sheetStyle = computed(() => {
    if (!isNarrow.value) return {} // desktop: CSS owns layout
    if (mode === 'fit') {
      return {
        transform: dragY.value ? `translateY(${dragY.value}px)` : '',
        transition: isDragging.value ? 'none' : 'transform 0.2s ease',
      }
    }
    return {
      height: `${(sheetFrac.value * 100).toFixed(1)}vh`,
      transition: isDragging.value ? 'none' : 'height 0.2s ease',
    }
  })

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
    dragY.value = 0
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
