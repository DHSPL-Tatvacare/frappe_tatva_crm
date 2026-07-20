import { call } from 'frappe-ui'
import { ref } from 'vue'

// TATVA: Workflows access gate (sidebar visibility). Mirrors composables/nearMe.js — a reactive ref
// populated once on app load from the SAME server rule that authorises the page
// (tatva_connect.workflow_engine.permissions.workflow_access). The link only renders when true, so a
// rep never sees a menu item that dead-ends. Fail-closed: any error keeps it false (no link).
export const workflowsVisible = ref(false)

export function resolveWorkflowsAccess() {
  call('tatva_connect.workflow_engine.permissions.workflow_access')
    .then((r) => {
      workflowsVisible.value = !!(r && r.visible)
    })
    .catch(() => {
      workflowsVisible.value = false
    })
}

resolveWorkflowsAccess()
