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
  // TATVA: what the sheet is positioned against. 'container' (default, today's behaviour) = the consumer's own `bottom`, for an ABSOLUTE sheet inside a positioned parent — NearMe. 'viewport' = fixed, and we place the top ourselves against the visual viewport.
  const anchor = opts.anchor ?? 'container'

  const sheetFrac = ref(collapsed) // snap mode: height as a fraction of the viewport
  const dragY = ref(0) // fit mode: downward drag offset in px (>= 0)
  const isDragging = ref(false)
  const settling = ref(false) // fit mode: true only while the released sheet springs back to rest
  const isNarrow = ref(false)
  // TATVA: the VISUAL viewport — what the user can actually see. The soft keyboard, the collapsing address bar and iOS's own scroll all move it, and it is the only frame a sheet may be positioned against.
  // iOS does NOT shrink the layout viewport for the keyboard; it scrolls the layout viewport under the visual one and reports `offsetTop`. A `position: fixed; bottom: 0` sheet is anchored to the LAYOUT viewport, so it slid off screen entirely on the first open.
  const vpHeight = ref(0)
  const vpTop = ref(0)
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
    // Sized against the VISUAL viewport, never in viewport units: the keyboard, the address bar and iOS's scroll are then one input, not three special cases.
    const h = Math.round(sheetFrac.value * vpHeight.value)
    if (anchor !== 'viewport')
      return { height: `${h}px`, transition: isDragging.value ? 'none' : 'height 0.2s ease' }
    // A fixed sheet is anchored to the LAYOUT viewport, which iOS scrolls out from under the visual one when the keyboard opens — that is how it left the screen entirely. Placing the top ourselves is what pins it.
    return {
      height: `${h}px`,
      top: `${Math.round(vpTop.value + vpHeight.value - h)}px`,
      bottom: 'auto',
      transition: isDragging.value ? 'none' : 'height 0.2s ease, top 0.2s ease',
    }
  })

  // The backdrop covers exactly what the user can see — `inset-0` covers the LAYOUT viewport, which on iOS leaves the dimmed area misaligned with the sheet once the page has scrolled.
  const overlayStyle = computed(() =>
    isNarrow.value
      ? { top: `${Math.round(vpTop.value)}px`, height: `${Math.round(vpHeight.value)}px`, bottom: 'auto' }
      : {},
  )

  // `scroll` as well as `resize`: iOS reports its keyboard scroll ONLY as a visualViewport scroll, and without it the sheet keeps the offset it had when the keyboard began animating.
  function readViewport() {
    const vv = window.visualViewport
    vpHeight.value = vv ? vv.height : window.innerHeight
    vpTop.value = vv ? vv.offsetTop : 0
  }

  onMounted(() => {
    mql = window.matchMedia('(max-width: 767px)')
    isNarrow.value = mql.matches
    mql.addEventListener('change', onMqChange)
    readViewport()
    window.visualViewport?.addEventListener('resize', readViewport)
    window.visualViewport?.addEventListener('scroll', readViewport)
    window.addEventListener('resize', readViewport)
  })
  onBeforeUnmount(() => {
    if (mql) mql.removeEventListener('change', onMqChange)
    window.visualViewport?.removeEventListener('resize', readViewport)
    window.visualViewport?.removeEventListener('scroll', readViewport)
    window.removeEventListener('resize', readViewport)
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
    overlayStyle,
    onDragStart,
    onDragMove,
    onDragEnd,
    lockBody,
    reset,
  }
}
