import { onBeforeUnmount, onMounted, ref } from 'vue'
import { globalStore } from '@/stores/global'

// TATVA: live run progress on the canvas — which node a run just executed, as it happens.

// How long a node stays lit after its event.
const HIGHLIGHT_MS = 4000

export function useLiveRun(workflowName) {
  // node_id -> outcome, for the nodes that ran recently.
  const activeNodes = ref({})
  const timers = new Map()

  function onStep(event) {
    if (!event || event.workflow !== workflowName.value) return
    activeNodes.value = { ...activeNodes.value, [event.node_id]: event.outcome }

    clearTimeout(timers.get(event.node_id))
    timers.set(
      event.node_id,
      setTimeout(() => {
        const next = { ...activeNodes.value }
        delete next[event.node_id]
        activeNodes.value = next
        timers.delete(event.node_id)
      }, HIGHLIGHT_MS),
    )
  }

  onMounted(() => {
    const { $socket } = globalStore()
    if (!$socket || !workflowName.value) return
    $socket.emit('doc_subscribe', 'CRM Workflow', workflowName.value)
    $socket.on('workflow_step', onStep)
  })

  onBeforeUnmount(() => {
    const { $socket } = globalStore()
    if ($socket && workflowName.value) {
      $socket.emit('doc_unsubscribe', 'CRM Workflow', workflowName.value)
      $socket.off('workflow_step', onStep)
    }
    timers.forEach((t) => clearTimeout(t))
    timers.clear()
  })

  return { activeNodes }
}
