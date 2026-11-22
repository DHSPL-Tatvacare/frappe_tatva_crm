import { computed } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'frappe-ui'
import { whenDone, openPanel, saveFile } from '@/stores/bulkActionsPanel'

// TATVA: every export surface's one reader: queue, then the Bulk Actions store saves the file in the tab that asked, on the job's own finish event.

export const useExportJob = defineStore('crm-export-job', () => {
  function saveIfReady(job) {
    if (job.status !== 'Completed' || !job.file_url) return
    saveFile(job.file_url, job.file_name)
    if (job.truncated) toast.warning(__('Only the first {0} rows were exported.', [job.rows]))
  }

  /** Hand this an export endpoint's `{ job, status }`; an answer with no job (a refusal) is left alone. */
  function track(queued) {
    if (!queued?.job) return false
    if (whenDone(queued.job, saveIfReady)) return true
    toast.info(__('Preparing your export…'), { action: { label: __('View'), onClick: openPanel } })
    return true
  }

  // frappe's own System Settings ceiling, already on the client in the boot's sysdefaults; every export surface states the same number.
  const rowLimit = computed(() => Number(window.sysdefaults?.max_report_rows) || 100000)

  return { rowLimit, track }
})
