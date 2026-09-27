// TATVA: one queued per-record provider refresh for every channel, addressed to the user who pressed it — no room, no other browser.
import { call, toast } from 'frappe-ui'
import { reactive } from 'vue'

const EVENT = 'tatva_record_refresh'

// Wording per channel; the server owns the failure text.
const LABELS = {
  whatsapp: {
    accepted: () => __('Refreshing WhatsApp history…'),
    already: () => __('Someone is already refreshing this history'),
    synced: (n) => __('Synced {0} new message(s)', [n]),
    current: () => __('History is already up to date'),
    failed: () => __('WhatsApp refresh failed'),
  },
  calls: {
    accepted: () => __('Refreshing call log…'),
    already: () => __('Someone is already refreshing this call log'),
    synced: (n) => __('Added {0} call(s)', [n]),
    current: () => __('Call log is already up to date'),
    failed: () => __('Call refresh failed'),
  },
}

// Module scope, not a component: the job outlives the screen, and two tabs on one record must agree.
const running = reactive({})
// When a `finished` last landed, so a probe that started before it cannot resurrect the flag with a stale answer.
const finishedAt = reactive({})
// A SIGKILLed worker, a slept laptop or a socketio restart means `finished` never arrives, so an optimistic disable carries its own deadline.
const timers = {}
const TIMEOUT_MS = 90000

let started = false

// Keyed by channel AND record: a rep may refresh calls while WhatsApp is still walking.
const keyOf = (channel, name) => `${channel}:${name}`

export function isRefreshing(channel, name) {
  return Boolean(running[keyOf(channel, name)])
}

function markRunning(key) {
  running[key] = true
  if (timers[key]) clearTimeout(timers[key])
  timers[key] = setTimeout(() => clearRunning(key), TIMEOUT_MS)
}

function clearRunning(key) {
  delete running[key]
  finishedAt[key] = Date.now()
  if (timers[key]) {
    clearTimeout(timers[key])
    delete timers[key]
  }
}

// RQ is the truth, for everyone the realtime event never reached: a later arrival, a second rep, a reloaded tab.
export async function syncRefreshState(channel, doctype, name) {
  if (!name) return
  const key = keyOf(channel, name)
  const askedAt = Date.now()
  try {
    const res = await call('tatva_connect.channels.refresh.state', {
      channel,
      reference_doctype: doctype,
      reference_name: name,
    })
    if (res?.running && !(finishedAt[key] > askedAt)) {
      markRunning(key)
    } else if (!res?.running) {
      clearRunning(key)
    }
  } catch {
    // A failed probe must not fake a lock; the server's deduplicate refuses a real duplicate anyway.
    clearRunning(key)
  }
}

export function startTatvaRecordRefresh(crmSocket) {
  if (started || !crmSocket) return
  started = true

  crmSocket.on(EVENT, (payload) => {
    const name = payload?.reference_name
    const channel = payload?.channel
    const labels = LABELS[channel]
    if (!name || !labels) return
    const key = keyOf(channel, name)

    if (payload.state === 'started') {
      markRunning(key)
      // Acceptance, not completion: the server emits this the moment the job is queued.
      toast.info(labels.accepted())
      return
    }
    // An unknown state is not a completion.
    if (payload.state !== 'finished') return

    // Emitted from the server's finally-block, so a provider outage cannot leave the button disabled for ever.
    clearRunning(key)
    if (payload.error) {
      toast.error(payload.error)
      return
    }
    const count = payload.count ?? 0
    toast.success(count ? labels.synced(count) : labels.current())
  })
}

export async function refreshRecord(channel, doctype, name) {
  const key = keyOf(channel, name)
  if (running[key]) return
  // Optimistic: the button disables on click, `started` confirms, `finished` clears, the timeout covers a job that never reports.
  markRunning(key)
  try {
    const res = await call('tatva_connect.channels.refresh.start', {
      channel,
      reference_doctype: doctype,
      reference_name: name,
    })
    // Refused as a duplicate: the walk belongs to whoever started it, and its `finished` is addressed to them — so this button must not sit greyed waiting for one.
    if (res?.queued === false) {
      clearRunning(key)
      toast.info(LABELS[channel].already())
    }
  } catch (error) {
    clearRunning(key)
    toast.error(error?.messages?.[0] || LABELS[channel].failed())
  }
}
