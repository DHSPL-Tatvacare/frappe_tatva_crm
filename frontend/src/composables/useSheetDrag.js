import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// TATVA: the ONE bottom-sheet engine (C.20) — a 'snap' panel (Near Me) or a 'fit' modal; a sheet marks `data-sheet-grab` / `data-sheet-scroll` and hands its root to `bindSheet`.

// The one spring every sheet settles on — the lead modal's slide.
const SETTLE = 'transform 0.3s ease-out'
const SETTLE_MS = 320
// Movement under this is a tap, so a button in the grab area stays a button.
const TAP_PX = 6
// px per ms: a release at least this fast goes the way it was thrown.
const FLICK = 0.5
// A field is typed in, never grabbed.
const TYPED = 'input, textarea, select, [contenteditable="true"]'

export function useSheetDrag(opts = {}) {
  const mode = opts.mode ?? 'snap'
  const collapsed = opts.collapsed ?? 0.45
  const expanded = opts.expanded ?? 0.85
  const min = opts.min ?? 0.16
  const dismissible = opts.dismissible ?? false
  const dismissPx = opts.dismissPx ?? 110 // fit mode: drag this far down to dismiss
  const onDismiss = opts.onDismiss
  // TATVA: what the sheet is positioned against. 'container' = the consumer's own `bottom`, for an ABSOLUTE sheet inside a positioned parent (Near Me). 'viewport' = fixed, and we place the top ourselves against the visual viewport.
  const anchor = opts.anchor ?? 'container'
  const detents = dismissible
    ? [collapsed, expanded]
    : [min, collapsed, expanded]

  const sheetFrac = ref(collapsed) // snap: the resting height, as a fraction of the visual viewport
  const live = ref(collapsed) // snap: the height the finger or the spring is at while moving
  const moving = ref(false) // snap: dragging or settling — the sheet slides on the GPU at full height
  const dragY = ref(0) // fit: downward drag offset in px (>= 0)
  const isDragging = ref(false)
  const settling = ref(false) // the released sheet is springing to rest
  const isNarrow = ref(false)
  // TATVA: the VISUAL viewport — what the user can actually see. The soft keyboard, the collapsing address bar and iOS's own scroll all move it, and it is the only frame a sheet may be positioned against.
  const vpHeight = ref(0)
  const vpTop = ref(0)
  let mql = null
  let settleTimer = null

  // A class, never body.style.overflow: reka-ui captures that inline property and writes it back when its last overlay closes, freezing the page.
  function lockBody(on) {
    if (typeof document !== 'undefined')
      document.body.classList.toggle('tc-scroll-lock', on)
  }
  function onMqChange(e) {
    isNarrow.value = e.matches
  }
  function stopSettling() {
    if (settleTimer) clearTimeout(settleTimer)
    settleTimer = null
    settling.value = false
  }

  // ---- one gesture: begin at y, move to y, release — the touch handlers below are its only driver ----
  let startY = 0
  let startFrac = collapsed
  let samples = []

  function begin(y, t) {
    stopSettling()
    isDragging.value = true
    startY = y
    samples = [{ y, t }]
    if (mode === 'snap') {
      startFrac = sheetFrac.value
      live.value = startFrac
      moving.value = true
      if (!dismissible) lockBody(true) // a modal is already locked while open
    }
  }
  function moveTo(y, t) {
    samples.push({ y, t })
    while (samples.length > 2 && t - samples[0].t > 100) samples.shift()
    const dy = y - startY
    if (mode === 'fit') {
      dragY.value = Math.max(0, dy) // only downward: the content already fills upward
      return
    }
    const floor = dismissible ? 0 : min
    live.value = Math.min(
      expanded,
      Math.max(floor, startFrac - dy / (vpHeight.value || 1)),
    )
  }
  // Downward speed over the last 100 ms, px per ms (negative is upward).
  function velocity() {
    const a = samples[0]
    const b = samples[samples.length - 1]
    return b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0
  }
  function release() {
    isDragging.value = false
    const v = velocity()
    if (mode === 'fit') {
      if (
        dismissible &&
        (dragY.value > dismissPx || (v > FLICK && dragY.value > TAP_PX * 3))
      ) {
        onDismiss?.() // the leave transition owns the exit
        dragY.value = 0
        return
      }
      settling.value = true
      dragY.value = 0
      settleTimer = setTimeout(stopSettling, SETTLE_MS)
      return
    }
    if (
      dismissible &&
      (live.value < min || (v > FLICK && live.value < collapsed))
    ) {
      moving.value = false
      onDismiss?.()
      return
    }
    // A flick goes to the next height in its direction; a slow release to the nearest.
    const at = live.value
    let target = detents.reduce((a, b) =>
      Math.abs(b - at) < Math.abs(a - at) ? b : a,
    )
    if (v > FLICK)
      target = [...detents].reverse().find((d) => d < at - 0.01) ?? detents[0]
    else if (v < -FLICK)
      target = detents.find((d) => d > at + 0.01) ?? detents[detents.length - 1]
    settleTo(target)
    if (!dismissible) lockBody(false)
  }

  // Slide to a resting height on the spring, then set the height once — the list re-lays out one time, not every frame.
  function settleTo(frac) {
    stopSettling()
    if (!moving.value) {
      live.value = sheetFrac.value
      moving.value = true
    }
    requestAnimationFrame(() => {
      settling.value = true
      live.value = frac
      settleTimer = setTimeout(() => {
        sheetFrac.value = frac
        moving.value = false
        stopSettling()
      }, SETTLE_MS)
    })
  }
  // A consumer moves the sheet with the same spring a hand would (Near Me lifts it to show a picked row).
  function snapTo(frac) {
    if (!isNarrow.value || mode !== 'snap' || frac === sheetFrac.value) return
    settleTo(frac)
  }

  // ---- touch: the grab area drags; a scroll area at its top pulls a snap panel down ------------------
  let touch = null // { y, grab } while a finger is down on the sheet
  function onTouchStart(e) {
    if (!isNarrow.value || e.touches.length !== 1 || e.target.closest(TYPED))
      return
    const scroller = e.target.closest('[data-sheet-scroll]')
    // A modal sheet's content never closes it from a scroll: a half-filled form must not be thrown away by a swipe.
    if (scroller && (mode !== 'snap' || scroller.scrollTop > 0)) return
    if (!scroller && !e.target.closest('[data-sheet-grab]')) return
    touch = { y: e.touches[0].clientY, scroller }
  }
  function onTouchMove(e) {
    if (!touch) return
    const y = e.touches[0].clientY
    if (!isDragging.value) {
      const dy = y - touch.y
      if (Math.abs(dy) < TAP_PX) return
      // From a scroll area only a downward pull moves the panel; upward is the content's own scroll.
      if (touch.scroller && dy < 0) {
        touch = null
        return
      }
      begin(touch.y, e.timeStamp)
    }
    e.preventDefault()
    moveTo(y, e.timeStamp)
  }
  function onTouchEnd() {
    if (touch && isDragging.value) release()
    touch = null
  }

  let bound = null
  // Hand the sheet's root here (a template ref callback); null unbinds. Touch only: a desktop sheet does not drag.
  function bindSheet(el) {
    if (bound === el) return
    if (bound) {
      bound.removeEventListener('touchstart', onTouchStart)
      bound.removeEventListener('touchmove', onTouchMove)
      bound.removeEventListener('touchend', onTouchEnd)
      bound.removeEventListener('touchcancel', onTouchEnd)
    }
    bound = el || null
    if (!bound) return
    bound.addEventListener('touchstart', onTouchStart, { passive: true })
    bound.addEventListener('touchmove', onTouchMove, { passive: false }) // the drag owns the gesture, so it may stop the page's
    bound.addEventListener('touchend', onTouchEnd)
    bound.addEventListener('touchcancel', onTouchEnd)
  }

  // Snap mode's resting height in px — the one number the style sizes by and Near Me's map inset reads; 0 on desktop.
  const sheetHeight = computed(() =>
    isNarrow.value && mode === 'snap'
      ? Math.round(sheetFrac.value * vpHeight.value)
      : 0,
  )
  const sheetStyle = computed(() => {
    if (!isNarrow.value) return {} // desktop: CSS owns layout
    if (mode === 'fit') {
      // drag: track the finger. settle: the spring. at rest: no inline transition, so the <Transition> enter/leave classes own open/close.
      return {
        transform: dragY.value ? `translateY(${dragY.value}px)` : '',
        transition: isDragging.value ? 'none' : settling.value ? SETTLE : '',
      }
    }
    // Sized against the VISUAL viewport, never in viewport units: the keyboard, the address bar and iOS's scroll are one input.
    const vh = vpHeight.value
    // Moving: full height, slid down by what is not shown — a GPU transform each frame instead of a re-layout.
    const h = Math.round((moving.value ? expanded : sheetFrac.value) * vh)
    const style = { height: `${h}px` }
    if (moving.value) {
      style.transform = `translateY(${Math.round((expanded - live.value) * vh)}px)`
      style.transition = settling.value ? SETTLE : 'none'
      style.willChange = 'transform'
    }
    // A fixed sheet is anchored to the LAYOUT viewport, which iOS scrolls out from under the visual one when the keyboard opens; placing the top ourselves pins it.
    if (anchor === 'viewport') {
      style.top = `${Math.round(vpTop.value + vh - h)}px`
      style.bottom = 'auto'
    }
    return style
  })

  // The backdrop covers exactly what the user can see — `inset-0` covers the LAYOUT viewport, misaligned on iOS once the page has scrolled.
  const overlayStyle = computed(() =>
    isNarrow.value
      ? {
          top: `${Math.round(vpTop.value)}px`,
          height: `${Math.round(vpHeight.value)}px`,
          bottom: 'auto',
        }
      : {},
  )

  // `scroll` as well as `resize`: iOS reports its keyboard scroll ONLY as a visualViewport scroll.
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
    bindSheet(null)
    stopSettling()
    lockBody(false)
  })

  function reset() {
    stopSettling()
    sheetFrac.value = collapsed
    moving.value = false
    dragY.value = 0
  }

  return {
    sheetFrac,
    sheetHeight,
    isDragging,
    isNarrow,
    sheetStyle,
    overlayStyle,
    bindSheet,
    snapTo,
    lockBody,
    reset,
  }
}
