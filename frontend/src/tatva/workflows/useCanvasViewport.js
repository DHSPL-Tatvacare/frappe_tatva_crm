// TATVA: the workflow canvas's one viewport. Only load and Tidy up fit (zoom); selecting a node only pans — reveal when hidden, centre when asked — and opening a panel never moves the graph.
import { nextTick, watch } from 'vue'
import { watchOnce } from '@vueuse/core'
import { useVueFlow } from '@vue-flow/core'

const FIT = { padding: 0.2, maxZoom: 1, duration: 200 }
const MOVE_MS = 200
// Breathing room so a revealed node does not sit flush against the pane edge.
const REVEAL_MARGIN = 24

// `selectedId` is the canvas's selection: whenever it or the pane's width changes, the selected node is revealed if hidden.
export function useCanvasViewport(selectedId) {
  const { fitView, setCenter, dimensions, findNode, vueFlowRef, flowToScreenCoordinate, getViewport, setViewport } = useVueFlow()

  // A centring in flight owns the view; a reveal during it would read a half-moved transform.
  let centring = false

  // Animated for Tidy up; `instant` for the first paint, which must land where it opens.
  const fitAll = ({ instant = false } = {}) => fitView(instant ? { ...FIT, duration: 0 } : FIT)

  // Centres a node at the current zoom; `afterResize` waits for the pane's new width, so an opening panel is centred around once.
  function centre(id, { afterResize = false } = {}) {
    const go = () => {
      const node = findNode(id)
      if (!node) return
      const { width = 0, height = 0 } = node.dimensions || {}
      centring = true
      setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: getViewport().zoom, duration: MOVE_MS })
        .finally(() => (centring = false))
    }
    if (afterResize) watchOnce(() => dimensions.value.width, go)
    else nextTick(go)
  }

  // Pans only as far as needed to bring a node fully into view; the library owns the transform, only the decision is ours.
  function reveal(id) {
    const node = findNode(id)
    const pane = vueFlowRef.value?.getBoundingClientRect()
    if (centring || !node || !pane) return
    const left = flowToScreenCoordinate({ x: node.position.x, y: node.position.y })
    const right = flowToScreenCoordinate({ x: node.position.x + (node.dimensions?.width || 0), y: node.position.y })
    const past = right.x - (pane.right - REVEAL_MARGIN)
    const short = pane.left + REVEAL_MARGIN - left.x
    const shift = past > 0 ? -past : short > 0 ? short : 0
    if (!shift) return
    const vp = getViewport()
    setViewport({ x: vp.x + shift, y: vp.y, zoom: vp.zoom })
  }

  // On the selection and again on the pane's measured width, so a panel that opens for the node is accounted for.
  watch(
    () => [selectedId.value, dimensions.value.width],
    ([id]) => id && reveal(id),
  )

  return { fitAll, centre }
}
