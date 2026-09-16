import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { call, toast } from 'frappe-ui'
import { globalStore } from '@/stores/global'

// TATVA: an export is prepared by a WORKER now, not inside the request, so the tab that asked has to be
// told when it lands. This is the one reader of that lifecycle, shared by every export surface.
//
// A STORE, NOT A COMPOSABLE. It used to be per-surface, registering its socket handlers in `onMounted`
// and tearing them down in `onBeforeUnmount` — so ANY route change killed the listener mid-drain and the
// file arrived with nobody there. An export is not the property of the screen that asked for it. Pinia
// gives one instance for the app's lifetime; both surfaces call `useExportJob()` exactly as before.
//
// TWO PATHS, ON PURPOSE. The socket is the FAST path: `tatva_connect/exports.py` publishes three
// user-targeted events and the file saves the moment one arrives. The poll is the GUARANTEE: a realtime
// event is lost whenever the tab was reconnecting, the laptop slept, or socketio itself is down, and an
// export that silently never arrives is the exact failure this change exists to remove. Whichever answers
// first wins and cancels the other, so a dead socket costs a few seconds, never the file.
//
// THIS TAB'S WAIT, AND NOTHING MORE. What a tab that was NOT here missed is the Bulk Actions panel's job
// and always was: `stores/bulkActionsPanel` already fetches the same `exports.mine` once at boot for the
// sidebar badge, lists every recent export with its status, and offers Download on a completed one. This
// store used to ask that endpoint a second time on every page load and re-offer the same file as a toast
// — a second copy of the panel's recovery, and a second call for one answer, kept honest by a localStorage
// note about which files had already been handed over. All three are gone; the panel is the one surface.

// Slow on purpose: the socket normally wins, so this only has to be faster than a person gives up.
const POLL_MS = 3000
// A drain is bounded by the worker's own timeout; stop asking well after that rather than for ever.
const POLL_CEILING_MS = 15 * 60 * 1000

export const useExportJob = defineStore('crm-export-job', () => {
  // Whether ANY surface is waiting — what the Export button reads while a worker drains.
  const preparing = ref(false)
  // The job being waited for. Every handler checks it: the events are per-USER, so a rep with two tabs
  // open would otherwise have one tab save the other tab's file.
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
    waitingFor = null
    if (poll) clearInterval(poll)
    poll = null
  }

  // ONE completion path for both the socket and the poll, so they cannot diverge on what "ready" means.
  function complete({ file_url: url, file_name: name, rows, truncated }) {
    settle()
    if (url) save(url, name)
    // The action is the recovery: a browser that blocked the automatic save still has one click to it.
    const again = url
      ? {
          action: {
            label: __('Download again'),
            onClick: () => save(url, name),
          },
        }
      : {}
    if (truncated)
      toast.warning(__('Only the first {0} rows were exported.', [rows]), again)
    else toast.success(__('Your export is ready.'), again)
  }

  function fail(message) {
    settle()
    toast.error(message || __('The export could not be prepared.'))
  }

  function mine(event) {
    return waitingFor && event?.job === waitingFor
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
      // Stop asking, but never pretend it failed — it may still be draining. The job row is the record,
      // and `if_owner` means Desk shows this person only their own, so the action is honest.
      const job = waitingFor
      settle()
      toast.info(__('Your export is still being prepared.'), {
        action: {
          label: __('View export'),
          onClick: () => window.open(`/app/crm-export-job/${job}`, '_blank'),
        },
      })
      return
    }
    let state
    try {
      state = await call('tatva_connect.exports.status', { job: waitingFor })
    } catch {
      return // a blip is not an answer; the next tick asks again
    }
    if (!mine(state)) return
    if (state.status === 'Completed') complete(state)
    else if (state.status === 'Error') fail(state.error)
  }

  /**
   * Hand this the result of an export endpoint — `{ job, status }` — and the app starts waiting.
   * An endpoint that answered without a job (a refusal, or a Desk path that still streams) is left alone.
   */
  function track(queued) {
    if (!queued?.job) return false
    settle() // a previous job's interval would otherwise keep ticking with nothing listening
    waitingFor = queued.job
    preparing.value = true
    pollStartedAt = Date.now()
    poll = setInterval(tick, POLL_MS)
    toast.info(__('Preparing your export…'))
    return true
  }

  const { $socket } = globalStore()
  if ($socket) {
    // Registered ONCE, for the app's lifetime — the whole reason this is a store. There is no teardown:
    // the listener must outlive every screen, and the store dies with the page.
    $socket.on('crm_export_ready', onReady)
    $socket.on('crm_export_failed', onFailed)
  }

  // frappe's own System Settings ceiling, already on the client in the boot's sysdefaults. It lives here
  // because it is a fact about an EXPORT, and every surface that offers one must state the same number.
  const rowLimit = computed(
    () => Number(window.sysdefaults?.max_report_rows) || 100000,
  )

  return { preparing, rowLimit, track }
})
