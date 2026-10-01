import { onBeforeUnmount, ref, watch } from 'vue'
import { globalStore } from '@/stores/global'
// The ONE owner of doc-room membership, so a reconnect re-joins this workflow's room.
import { docSubscribe, docUnsubscribe } from '@/tatva/docRooms'

// TATVA: live step progress on the canvas — which node a journey just executed and the line it walked, as it happens, only while a published version is on screen.

// How long a node or a line stays lit after its step.
const HIGHLIGHT_MS = 4000

// `workflowName` and `versionName` are refs; the room is joined only while there is a published version, since nothing runs without one.
export function useLiveSteps(workflowName, versionName) {
  // node_id -> outcome, and `from>to` -> true, for what ran recently.
  const activeNodes = ref({})
  const walkedLinks = ref({})
  // The node each journey stood on last, so its next step names the line between them.
  const lastNode = new Map()
  // One timer table per kept map, so a node id, a line key and a journey can never share a timer.
  const timers = new Map([[activeNodes, new Map()], [walkedLinks, new Map()], [lastNode, new Map()]])
  // Steps arrive in bursts under load; they are applied once per frame, not once per event.
  let pending = []
  let frame = 0

  // Runs `expire` HIGHLIGHT_MS after the latest call for this key in this table.
  function expireLater(owner, key, expire) {
    const table = timers.get(owner)
    clearTimeout(table.get(key))
    table.set(
      key,
      setTimeout(() => {
        table.delete(key)
        expire()
      }, HIGHLIGHT_MS),
    )
  }

  // Lights `key` in `draft` (the next value of `lit`) and puts it out HIGHLIGHT_MS later.
  function light(lit, draft, key, value) {
    draft[key] = value
    expireLater(lit, key, () => {
      const next = { ...lit.value }
      delete next[key]
      lit.value = next
    })
  }

  function flush() {
    frame = 0
    const nodes = { ...activeNodes.value }
    const links = { ...walkedLinks.value }
    for (const step of pending) {
      const from = lastNode.get(step.journey)
      if (from && from !== step.node_id) light(walkedLinks, links, `${from}>${step.node_id}`, true)
      lastNode.set(step.journey, step.node_id)
      expireLater(lastNode, step.journey, () => lastNode.delete(step.journey))
      light(activeNodes, nodes, step.node_id, step.outcome)
    }
    pending = []
    activeNodes.value = nodes
    walkedLinks.value = links
  }

  function onStep(event) {
    if (!event || event.workflow !== workflowName.value) return
    pending.push(event)
    frame ||= requestAnimationFrame(flush)
  }

  function leave(name) {
    const { $socket } = globalStore()
    if (!$socket || !name) return
    docUnsubscribe('CRM Workflow', name)
    $socket.off('workflow_step', onStep)
  }

  watch(
    () => (versionName.value ? workflowName.value : null),
    (name, previous) => {
      leave(previous)
      const { $socket } = globalStore()
      if (!$socket || !name) return
      docSubscribe('CRM Workflow', name)
      $socket.on('workflow_step', onStep)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    leave(versionName.value ? workflowName.value : null)
    cancelAnimationFrame(frame)
    timers.forEach((table) => table.forEach((t) => clearTimeout(t)))
  })

  return { activeNodes, walkedLinks }
}
