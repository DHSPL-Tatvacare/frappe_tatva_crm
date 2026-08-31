import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { computed, ref } from 'vue'

export const visible = ref(false)

const bulkJobs = createResource({
  url: 'tatva_connect.bulk_actions.mine',
  initialData: [],
  auto: true,
})

const exportJobs = createResource({
  url: 'tatva_connect.exports.mine',
  initialData: [],
  auto: true,
})

const ACTION_VERBS = {
  Assign: 'Assign',
  'Clear Assignment': 'Clear Assignment',
  'Bulk Edit': 'Bulk Edit',
  'Bulk Delete': 'Bulk Delete',
}

function normalizeBulk(j) {
  return {
    kind: 'bulk',
    job: j.job,
    title: `${ACTION_VERBS[j.action] || j.action} · ${j.total} record${j.total === 1 ? '' : 's'}`,
    status: j.status,
    creation: j.creation,
    total: j.total,
    succeeded: j.succeeded,
    failed: j.failed,
    failed_names: j.failed_names ?? null,
    rows: null,
    truncated: null,
    file_url: null,
    file_name: null,
    error: j.error ?? null,
  }
}

function normalizeExport(j) {
  return {
    kind: 'export',
    job: j.job,
    title: `Export · ${j.source === 'Smart View' ? j.reference : j.reference || 'List'}`,
    status: j.status,
    creation: j.creation,
    total: null,
    succeeded: null,
    failed: null,
    failed_names: null,
    rows: j.rows,
    truncated: j.truncated,
    file_url: j.file_url ?? null,
    file_name: j.file_name ?? null,
    error: j.error ?? null,
  }
}

export const jobs = computed(() => {
  const bulk = (bulkJobs.data || []).map(normalizeBulk)
  const exportd = (exportJobs.data || []).map(normalizeExport)
  return [...bulk, ...exportd].sort((a, b) => new Date(b.creation) - new Date(a.creation))
})

export const runningCount = computed(
  () => jobs.value.filter((j) => j.status === 'Queued' || j.status === 'Started').length,
)

export const bulkActionsPanelStore = defineStore('crm-bulk-actions-panel', () => {
  function toggle() {
    visible.value = !visible.value
  }

  function reload() {
    bulkJobs.reload()
    exportJobs.reload()
  }

  return { jobs, runningCount, toggle, reload }
})
