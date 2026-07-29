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
  // TATVA: px the soft keyboard covers at the bottom, as a ref the consumer keeps current. ONE owner for the sheet's geometry: height and bottom are decided together here, because deciding them apart is what made the sheet jump — see sheetStyle.
  const keyboardInset = opts.keyboardInset ?? ref(0)

  const sheetFrac = ref(collapsed) // snap mode: height as a fraction of the viewport
  const dragY = ref(0) // fit mode: downward drag offset in px (>= 0)
  const isDragging = ref(false)
  const settling = ref(false) // fit mode: true only while the released sheet springs back to rest
  const isNarrow = ref(false)
  let mql = null
  let settleTimer = null
  let dragStartY = 0
  let dragStartFrac = collapsed

  // A class, never body.style.overflow: reka-ui (every frappe-ui Dialog/Select/Link/Dropdown) captures that inline property and restores it when the last of them closes, so an inline lock of ours gets captured and written back, freezing the page with nothing on screen.
  function lockBody(on) {
    if (typeof document !== 'undefined') document.body.classList.toggle('tc-scroll-lock', on)
  }
  function onMqChange(e) {
    isNarrow.value = e.matches
  }
  function onDragStart(e) {
    isDragging.value = true
    settling.value = false // a fresh grab cancels any in-flight spring-back
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null }
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
      // Past the threshold → close: clear dragY so the inline transform drops and the leave class owns the exit.
      if (dismissible && dragY.value > dismissPx) {
        onDismiss?.()
        dragY.value = 0
        return
      }
      // Under the threshold → animate the spring back to rest, then hand control back to the enter/leave classes.
      settling.value = true
      dragY.value = 0
      settleTimer = setTimeout(() => (settling.value = false), 320)
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
      // drag: track the finger with no easing. settle: spring back. at rest: no inline transition, so the <Transition> enter/leave classes own the open/close timing.
      return {
        transform: dragY.value ? `translateY(${dragY.value}px)` : '',
        transition: isDragging.value ? 'none' : settling.value ? 'transform 0.3s ease-out' : '',
      }
    }
    // The keyboard is subtracted from the HEIGHT as well as added to the bottom, so the sheet's TOP edge
    // does not move when it opens — 844 - 336 - (506-336) is the same 338 the sheet already rested at.
    // Lifting the bottom alone kept the full height and shot the top from 338px to 2px on every focus.
    const kb = keyboardInset.value
    return {
      height: kb
        ? `calc(${(sheetFrac.value * 100).toFixed(1)}vh - ${kb}px)`
        : `${(sheetFrac.value * 100).toFixed(1)}vh`,
      bottom: kb ? `${kb}px` : '',
      transition: isDragging.value ? 'none' : 'height 0.2s ease, bottom 0.2s ease',
    }
  })

  onMounted(() => {
    mql = window.matchMedia('(max-width: 767px)')
    isNarrow.value = mql.matches
    mql.addEventListener('change', onMqChange)
  })
  onBeforeUnmount(() => {
    if (mql) mql.removeEventListener('change', onMqChange)
    if (settleTimer) clearTimeout(settleTimer)
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
