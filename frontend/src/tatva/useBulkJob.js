import { call, toast, LoadingIndicator } from 'frappe-ui'
import { h } from 'vue'
import { globalStore } from '@/stores/global'
import { refreshJobs } from '@/stores/bulkActionsPanel'

// TATVA: the shared reader for a list action (Assign / Clear Assignment / Bulk Edit / Bulk Delete),
// every one of which `tatva_connect.bulk_actions.run_or_queue` runs on a worker. Modeled
// on `useExportJob` (`@/tatva/useExportJob.js`): the socket is the FAST path — `bulk_actions.py`
// publishes `crm_bulk_ready` / `crm_bulk_failed` on this user's own socket room the moment a queued
// job finishes — and the poll is the GUARANTEE, because a realtime event is lost whenever the tab
// was reconnecting, the laptop slept, or socketio itself is down. Whichever answers first wins.
//
// UNLIKE `useExportJob`, this is a plain composable, not a Pinia store: each of the modals
// calls `runOrQueue` for its own action and owns the resulting `onComplete`, so there is no single
// app-lifetime job to keep alive across a route change. `globalStore()` still supplies `$socket`
// (the one socket.io connection the app already holds, wired up in `src/socket.js`/`main.js`), the
// same way `useExportJob` reads it — grabbed once here, while this composable's caller is still
// inside its own `setup()`, since `globalStore`'s use of `getCurrentInstance()` needs that context.

// The ONLY duration this file owns. How long a job may live is the job's own business: the server
// reports a row past its enqueue timeout as failed, which is what ends this watch (`bulk_actions._abandoned`).
const POLL_INTERVAL_MS = 4000

// A human present-tense verb for the queued-toast, not the raw internal action key — 'Bulk Edit queued
// for 40 rows' reads oddly, and the key is never translatable on its own. Translated at use, not here,
// since `__` is only wired up once the app boots (`src/translation.js`), not at module-eval time.
const ACTION_VERBS = {
  Assign: 'Assigning',
  'Clear Assignment': 'Clearing assignment on',
  Reassign: 'Reassigning',
  'Bulk Edit': 'Updating',
  'Bulk Delete': 'Deleting',
}

export function useBulkJob() {
  const { $socket } = globalStore()

  function watchJob(job, onComplete) {
    let settled = false
    let pollTimer = null

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
    }, POLL_INTERVAL_MS)
  }

  async function runOrQueue(action, doctype, docnames, params, onComplete, quiet = false) {
    const names = Array.isArray(docnames) ? docnames : Array.from(docnames)
    const result = await call('tatva_connect.bulk_actions.run_or_queue', {
      action,
      doctype,
      docnames: JSON.stringify(names),
      params: JSON.stringify(params || {}),
    })
    if (!quiet) {
      const verb = __(ACTION_VERBS[action] || action)
      toast.info(
        names.length === 1
          ? __('{0} 1 record…', [verb])
          : __('{0} {1} records…', [verb, names.length]),
      )
    }
    if (!result.job) {
      // The seam always queues; an answer with no job is a server that cannot be watched, not a wait.
      throw new Error(__('The action did not start. Please try again.'))
    }
    refreshJobs() // the record shows its state now, not when a socket gets round to it
    watchJob(result.job, onComplete)
    return result
  }

  // THE delete door for every surface — the list's selection and a record's own header alike. One
  // sticky toast carries the whole thing, replaced in place when the job answers (the `CallUI` idiom).
  async function deleteRecords(doctype, names, deleteLinked, onDone) {
    const id = `delete-${doctype}-${names[0]}-${names.length}`
    const label =
      names.length === 1
        ? __('Deleting {0}…', [names[0]])
        : __('Deleting {0} records…', [names.length])
    toast.create({
      id,
      message: label,
      type: 'info',
      duration: 0,
      icon: () => h(LoadingIndicator, { class: 'text-ink-white' }),
    })
    const settle = (message, type) => {
      toast.remove(id)
      toast.create({ id, message, type })
    }
    try {
      await runOrQueue(
        'Bulk Delete',
        doctype,
        names,
        { delete_linked: deleteLinked },
        (result) => {
          if (result.status === 'Error' || result.failed) {
            settle(
              names.length === 1
                ? result.error ||
                    __('{0} could not be deleted — it is still linked to other documents', [names[0]])
                : __('{0} of {1} could not be deleted — still linked to other documents', [
                    result.failed,
                    result.total,
                  ]),
              'error',
            )
          } else {
            settle(
              names.length === 1
                ? __('Deleted {0}', [names[0]])
                : __('Deleted {0} records', [result.succeeded ?? result.total]),
              'success',
            )
          }
          onDone?.(result)
        },
        true, // this door draws its own toast
      )
    } catch (e) {
      settle(e?.messages?.[0] || __('Could not delete'), 'error')
      throw e
    }
  }

  return { runOrQueue, deleteRecords }
}
