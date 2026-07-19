// TATVA: the WhatsApp history refresh is a QUEUED job, not a request. It walks the provider's API
// for 5-15 seconds — long enough that a synchronous call leaves the rep on a dead screen, short
// enough that nobody builds for it. tatva_connect/api/whatsapp.py enqueues and reports through
// Frappe's own realtime channel: ONE event, `whatsapp_refresh`, carrying its own state.
//
// State lives at MODULE scope, not in Activities.vue, for two reasons:
//   * the job outlives the component. A listener inside onMounted dies when the rep navigates away,
//     and the completion toast dies with it — which is the whole thing being asked for.
//   * two tabs on the same lead must agree on whether a refresh is in flight. A local ref cannot.
//
// Keyed by LEAD, because "is a refresh running" is a question about a lead, not about the app.
// Same shape as presence/notify: one start* attached to the app socket from App.vue, one guard.
import { call, toast } from 'frappe-ui'
import { reactive } from 'vue'

const REFRESH_EVENT = 'whatsapp_refresh'

const running = reactive({})
let started = false

export function isWhatsAppRefreshing(name) {
  return Boolean(running[name])
}

// Ask the SERVER whether a refresh is in flight for this lead. The realtime event only reaches a
// client that was already watching; this covers everyone else — a rep who opens the lead after the
// job started, a second rep on the same lead, a reloaded tab. RQ is the source of truth, so there is
// no state of ours to go stale if a worker dies mid-job.
export async function syncWhatsAppRefreshState(doctype, name) {
  if (!name) return
  try {
    const res = await call('tatva_connect.api.whatsapp.whatsapp_refresh_state', {
      reference_doctype: doctype,
      reference_name: name,
    })
    if (res?.running) {
      running[name] = true
    } else {
      delete running[name]
    }
  } catch (error) {
    // A failed probe must not fake a lock: leave the button usable and let the server's
    // deduplicate refuse a duplicate job if one really is running.
    delete running[name]
  }
}

export function startTatvaWhatsAppRefresh(crmSocket) {
  if (started || !crmSocket) return
  started = true

  crmSocket.on(REFRESH_EVENT, (payload) => {
    const name = payload?.reference_name
    if (!name) return
    if (payload.state === 'started') {
      running[name] = true
      return
    }
    // `finished` clears the flag whatever the outcome — the server emits it from a finally-block, so
    // a provider outage cannot leave the button disabled for ever.
    delete running[name]
    if (payload.error) {
      toast.error(payload.error)
      return
    }
    const count = payload.count ?? 0
    toast.success(
      count
        ? __('Synced {0} new message(s)', [count])
        : __('History is already up to date'),
    )
  })
}

export async function refreshWhatsAppHistory(doctype, name) {
  if (running[name]) return
  // Optimistic: the button disables on click, not on the server's echo. `started` confirms it and
  // `finished` clears it; the catch covers the case where the job was never queued at all.
  running[name] = true
  try {
    await call('tatva_connect.api.whatsapp.refresh_messages_from_wati', {
      reference_doctype: doctype,
      reference_name: name,
    })
  } catch (error) {
    delete running[name]
    toast.error(error?.messages?.[0] || __('WhatsApp refresh failed'))
  }
}
