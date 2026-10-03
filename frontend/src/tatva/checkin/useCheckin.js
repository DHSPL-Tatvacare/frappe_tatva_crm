// TATVA: the ONE check-in brain (C.26). The user menu, the login prompt and the logout ask all read this module's single get_status resource, so a page load asks the server once.
import { computed, h, ref, watch } from 'vue'
import { createResource, toast } from 'frappe-ui'
import CheckinStatus from '@/tatva/checkin/CheckinStatus.vue'

const API = 'tatva_connect.api.checkin'

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
  })
  _set = createResource({ url: `${API}.set_status`, onError() {} })
  _dismiss = createResource({ url: `${API}.dismiss_prompt`, onError() {} })
  _status.fetch().catch(() => {})
  // The server marks a notice shown when it sends it; the flag only stops a later set_status reply re-toasting it.
  watch(
    () => _status.data?.notice,
    (notice) => {
      if (!notice || noticeShown || !enabled()) return
      noticeShown = true
      const d = _status.data
      toast.create({
        message: __('{0} set your status to {1}', [
          d.changed_by_name || d.changed_by || __('Your manager'),
          checkinLabel(d.status),
        ]),
        type: 'info',
      })
    },
  )
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
