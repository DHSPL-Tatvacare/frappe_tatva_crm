import { onBeforeUnmount, onMounted, ref } from 'vue'
import { call, toast } from 'frappe-ui'
import { globalStore } from '@/stores/global'

// TATVA: an export is prepared by a WORKER now, not inside the request, so the tab that asked has to be
// told when it lands. This is the one reader of that lifecycle, shared by every export surface.
//
// TWO PATHS, ON PURPOSE. The socket is the FAST path: `tatva_connect/exports.py` publishes three
// user-targeted events and the file saves the moment one arrives. The poll is the GUARANTEE: a realtime
// event is lost whenever the tab was reconnecting, the laptop slept, or socketio itself is down, and an
// export that silently never arrives is the exact failure this change exists to remove. Whichever answers
// first wins and cancels the other, so a dead socket costs a few seconds, never the file.

// Slow on purpose: the socket normally wins, so this only has to be faster than a person gives up.
const POLL_MS = 3000
// A drain is bounded by the worker's own timeout; stop asking well after that rather than for ever.
const POLL_CEILING_MS = 15 * 60 * 1000

export function useExportJob() {
  // Whether THIS surface is waiting, and how far the worker has got — both are for the button label.
  const preparing = ref(false)
  const rowsSoFar = ref(0)
  // The job this surface waits for. Every handler checks it: the events are per-USER, so a rep with two
  // tabs open would otherwise have one tab save the other tab's file.
  let waitingFor = null
  let poll = null
  let pollStartedAt = 0

  function save(url, fileName) {
    // A real anchor, not `location.href`: the file is private and served as an attachment, and navigating
    // the list away to fetch it is worse than a download that simply happens.
    const a = document.createElement('a')
    a.href = url
    if (fileName) a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function settle() {
    preparing.value = false
    rowsSoFar.value = 0
    waitingFor = null
    if (poll) clearInterval(poll)
    poll = null
  }

  // ONE completion path for both the socket and the poll, so they cannot diverge on what "ready" means.
  function complete({ file_url: url, file_name: name, rows, truncated }) {
    settle()
    if (url) save(url, name)
    if (truncated)
      toast.warning(__('Only the first {0} rows were exported.', [rows]))
    else toast.success(__('Your export is ready.'))
  }

  function fail(message) {
    settle()
    toast.error(message || __('The export could not be prepared.'))
  }

  function mine(event) {
    return waitingFor && event?.job === waitingFor
  }

  function onProgress(event) {
    if (mine(event)) rowsSoFar.value = event.rows || 0
  }
  function onReady(event) {
    if (mine(event)) complete(event)
  }
  function onFailed(event) {
    if (mine(event)) fail(event?.error)
  }

  async function tick() {
    if (!waitingFor) return
    if (Date.now() - pollStartedAt > POLL_CEILING_MS) {
      // Stop asking, but never pretend it failed — it may still be draining, and `recent()` will find it.
      settle()
      toast.info(
        __(
          'Your export is taking a while. It will appear in your recent exports.',
        ),
      )
      return
    }
    let state
    try {
      state = await call('tatva_connect.exports.status', { job: waitingFor })
    } catch (error) {
      return // a blip is not an answer; the next tick asks again
    }
    if (!mine(state)) return
    if (state.status === 'Completed') complete(state)
    else if (state.status === 'Error') fail(state.error)
  }

  /**
   * Hand this the result of an export endpoint — `{ job, status }` — and the surface starts waiting.
   * An endpoint that answered without a job (a refusal, or a Desk path that still streams) is left alone.
   */
  function track(queued) {
    if (!queued?.job) return false
    waitingFor = queued.job
    rowsSoFar.value = 0
    preparing.value = true
    pollStartedAt = Date.now()
    poll = setInterval(tick, POLL_MS)
    toast.info(__('Preparing your export…'))
    return true
  }

  onMounted(() => {
    const { $socket } = globalStore()
    if (!$socket) return
    $socket.on('crm_export_progress', onProgress)
    $socket.on('crm_export_ready', onReady)
    $socket.on('crm_export_failed', onFailed)
  })

  onBeforeUnmount(() => {
    settle()
    const { $socket } = globalStore()
    if (!$socket) return
    $socket.off('crm_export_progress', onProgress)
    $socket.off('crm_export_ready', onReady)
    $socket.off('crm_export_failed', onFailed)
  })

  return { preparing, rowsSoFar, track }
}
