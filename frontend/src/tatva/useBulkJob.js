import { call, toast } from 'frappe-ui'
import { globalStore } from '@/stores/global'

// TATVA: the shared reader for a bulk list action (Assign / Clear Assignment / Bulk Edit / Bulk
// Delete) that `tatva_connect.bulk_actions.run_or_queue` decided was too big to run inline. Modeled
// on `useExportJob` (`@/tatva/useExportJob.js`): the socket is the FAST path — `bulk_actions.py`
// publishes `crm_bulk_ready` / `crm_bulk_failed` on this user's own socket room the moment a queued
// job finishes — and the poll is the GUARANTEE, because a realtime event is lost whenever the tab
// was reconnecting, the laptop slept, or socketio itself is down. Whichever answers first wins.
//
// UNLIKE `useExportJob`, this is a plain composable, not a Pinia store: each of the four modals
// calls `runOrQueue` for its own action and owns the resulting `onComplete`, so there is no single
// app-lifetime job to keep alive across a route change. `globalStore()` still supplies `$socket`
// (the one socket.io connection the app already holds, wired up in `src/socket.js`/`main.js`), the
// same way `useExportJob` reads it — grabbed once here, while this composable's caller is still
// inside its own `setup()`, since `globalStore`'s use of `getCurrentInstance()` needs that context.

const POLL_INTERVAL_MS = 4000
const REALTIME_GRACE_MS = 10000
// Mirrors `useExportJob`'s POLL_CEILING_MS: a drain is bounded by the worker's own timeout, so this
// stops asking well after that rather than polling a stuck or dead job forever.
const POLL_CEILING_MS = 15 * 60 * 1000

// A human present-tense verb for the queued-toast, not the raw internal action key — 'Bulk Edit queued
// for 40 rows' reads oddly, and the key is never translatable on its own. Translated at use, not here,
// since `__` is only wired up once the app boots (`src/translation.js`), not at module-eval time.
const ACTION_VERBS = {
  Assign: 'Assigning',
  'Clear Assignment': 'Clearing assignment on',
  'Bulk Edit': 'Updating',
  'Bulk Delete': 'Deleting',
}

export function useBulkJob() {
  const { $socket } = globalStore()

  function watchJob(job, onComplete, total) {
    let settled = false
    let pollTimer = null
    const startedAt = Date.now()

    const finish = (result) => {
      if (settled) return
      settled = true
      $socket?.off('crm_bulk_ready', onEvent)
      $socket?.off('crm_bulk_failed', onEvent)
      clearTimeout(pollTimer)
      onComplete(result)
    }

    const onEvent = (payload) => {
      if (payload?.job === job) finish(payload)
    }

    if ($socket) {
      $socket.on('crm_bulk_ready', onEvent)
      $socket.on('crm_bulk_failed', onEvent)
    }

    // No socket, or the socket stays quiet: ask the server directly rather than wait forever.
    pollTimer = setTimeout(function poll() {
      // Give up rather than poll a stuck/dead job forever; the job row itself remains the record.
      if (Date.now() - startedAt > POLL_CEILING_MS) {
        finish({
          job,
          status: 'Error',
          total,
          succeeded: 0,
          failed: total,
          timedOut: true,
        })
        return
      }
      call('tatva_connect.bulk_actions.status', { job })
        .then((result) => {
          if (result.status === 'Completed' || result.status === 'Error') {
            finish(result)
          } else {
            pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
          }
        })
        .catch(() => {
          // A blip is not an answer; the next tick asks again.
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
        })
    }, REALTIME_GRACE_MS)
  }

  async function runOrQueue(action, doctype, docnames, params, onComplete) {
    const names = Array.isArray(docnames) ? docnames : Array.from(docnames)
    const result = await call('tatva_connect.bulk_actions.run_or_queue', {
      action,
      doctype,
      docnames: JSON.stringify(names),
      params: JSON.stringify(params || {}),
    })
    if (result.queued) {
      const verb = __(ACTION_VERBS[action] || action)
      toast.info(__('{0} {1} rows…', [verb, names.length]))
      watchJob(result.job, onComplete, names.length)
    } else {
      onComplete(result)
    }
    return result
  }

  return { runOrQueue }
}
