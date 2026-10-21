// TATVA: the ONE check-in brain (C.26). The user menu, the login prompt and the logout ask all read this module's single get_status resource, so a page load asks the server once.
import { computed, h, ref, watch } from 'vue'
import { createResource, dayjsLocal, toast } from 'frappe-ui'
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import CheckinStatus from '@/tatva/checkin/CheckinStatus.vue'

const API = 'tatva_connect.api.checkin'
// The server's "your card changed" push (checkin.CARD_EVENT); it carries nothing, the tab re-reads get_status.
const CARD_EVENT = 'tatva_checkin'

// Helpdesk's three categories (CI1); the order is the menu order.
export const CHECKIN_STATUSES = ['Active', 'Away', 'Unavailable']
// Helpdesk's own words: the status is its name, and "Set status" before the first one.
export const checkinLabel = (status) => __(status || 'Set status')

let _status = null
let _set = null
let _dismiss = null
const dismissed = ref(false)
// The logout to finish once the rep answers the Unavailable question; null while nothing is asked.
const pendingLogout = ref(null)
let noticeShown = false
// A push that landed while the tab was hidden: the tab re-reads the moment it is seen again, past the 30 s throttle.
let stale = false
let pushStarted = false

// The one gate: only an explicit `enabled: true` shows anything; false, absent (older backend) or no reply is stock.
const enabled = () => _status?.data?.enabled === true

function resources() {
  if (_status) return
  // No `cache`: prompt and notice are per-session answers, and a disk copy would replay them on the next load.
  _status = createResource({
    url: `${API}.get_status`,
    method: 'GET',
    // Decoration: an older backend without the endpoint, or a refusal, leaves data null and every surface hidden.
    onError() {},
    // The server keeps "Not now" for today, so a fresh answer decides; a tab left open overnight is asked again.
    onSuccess: () => (dismissed.value = false),
  })
  _set = createResource({ url: `${API}.set_status`, onError() {} })
  _dismiss = createResource({ url: `${API}.dismiss_prompt`, onError() {} })
  _status.fetch().catch(() => {})
  // A tab coming back into view asks again: a shift may have opened, or another tab answered, while it was hidden.
  const recheck = useThrottleFn(() => enabled() && _status.reload(), 30000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (!stale) return recheck()
    stale = false
    _status.reload()
  })
  // The server marks a notice shown when it sends it; the flag only stops a later set_status reply re-toasting it.
  watch(
    () => _status.data?.notice,
    (notice) => {
      if (!notice || noticeShown || !enabled()) return
      noticeShown = true
      const d = _status.data
      // The shift-end check-out is the system's, so it is told as the shift ending, with when the next one opens.
      const message =
        d.source === 'Shift End'
          ? d.lead_flow?.next_at
            ? __('Your shift ended. You are Unavailable until {0}', [
                dayjsLocal(d.lead_flow.next_at).format('ddd HH:mm'),
              ])
            : __('Your shift ended. You are Unavailable')
          : __('{0} set your status to {1}', [
              d.changed_by_name || d.changed_by || __('Your manager'),
              checkinLabel(d.status),
            ])
      toast.create({ message, type: 'info' })
    },
  )
}

// The server pushes CARD_EVENT once per change (status, a pool pick, a lead worked); every open tab re-reads its card once.
export function startTatvaCheckin(crmSocket) {
  if (pushStarted || !crmSocket) return
  pushStarted = true
  resources()
  // A burst of changes seconds apart becomes one read; a hidden tab only marks itself stale.
  const refetch = useDebounceFn(() => enabled() && _status.reload(), 1500, {
    maxWait: 5000,
  })
  crmSocket.on(CARD_EVENT, () => {
    if (document.visibilityState === 'visible') refetch()
    else stale = true
  })
}

// One write path for every surface; the reply has get_status's shape, so it becomes the shared data without a second fetch.
function setCheckin(status) {
  if (!CHECKIN_STATUSES.includes(status)) return Promise.resolve(null)
  return _set
    .submit({ status })
    .then((data) => {
      _status.setData(data)
      toast.success(checkinLabel(data?.status))
      return data
    })
    .catch((e) => {
      toast.error(__('Could not update your status'))
      throw e
    })
}

// "Not now" (or closing the prompt) is an answer: hide at once, tell the server so this session is never asked again (CI9).
function dismissPrompt() {
  dismissed.value = true
  _dismiss.submit().catch(() => {})
}

// CI10: ask about Unavailable only when enabled and Active; otherwise log out exactly as before.
function logoutWithCheckout(logout) {
  if (!enabled() || _status.data.status !== 'Active') return logout()
  pendingLogout.value = logout
}

// The answer at logout: a failed status change keeps the session open so the rep can try again.
async function finishLogout(setUnavailable) {
  const logout = pendingLogout.value
  if (!logout) return
  if (setUnavailable && !(await setCheckin('Unavailable').catch(() => null)))
    return
  pendingLogout.value = null
  logout()
}

function cancelLogout() {
  pendingLogout.value = null
}

const statusIcon = (status) => () => h(CheckinStatus, { status })

export function useCheckin() {
  resources()
  // Hidden until the server answers enabled; a missing endpoint never answers.
  const shown = computed(enabled)
  const status = computed(() => _status.data?.status || '')
  const showPrompt = computed(
    () => shown.value && !!_status.data.prompt && !dismissed.value,
  )
  const saving = computed(() => _set.loading)

  // Helpdesk's mobile pattern: one native Dropdown item with a submenu, placed by the menu under Apps.
  const checkinMenuItem = computed(() =>
    shown.value
      ? {
          label: checkinLabel(_status.data?.status),
          icon: statusIcon(_status.data?.status),
          submenu: CHECKIN_STATUSES.map((s) => ({
            label: __(s),
            icon: statusIcon(s),
            onClick: () => {
              if (s !== _status.data?.status) setCheckin(s).catch(() => {})
            },
          })),
        }
      : null,
  )

  return {
    resource: _status,
    shown,
    status,
    // Why the pool gives this rep no lead now, decided on the server by the draw's own check; absent (an older backend) reads as none.
    leadFlow: computed(() => _status.data?.lead_flow || null),
    // One read at a time: a re-read already in flight answers every caller.
    reload: () => _status.loading || _status.reload(),
    showPrompt,
    saving,
    checkinMenuItem,
    setCheckin,
    dismissPrompt,
    logoutWithCheckout,
    askingLogout: computed(() => !!pendingLogout.value),
    finishLogout,
    cancelLogout,
  }
}
