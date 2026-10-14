import { computed } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'frappe-ui'
import { whenDone, openPanel } from '@/stores/bulkActionsPanel'

// TATVA: every export surface's one reader: queue, then the Bulk Actions store saves the file in the tab that asked, on the job's own finish event.

export const useExportJob = defineStore('crm-export-job', () => {
  // A real anchor, not `location.href`: the file is private and served as an attachment.
  function save(url, fileName) {
    const a = document.createElement('a')
    a.href = url
    if (fileName) a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function saveIfReady(job) {
    if (job.status !== 'Completed' || !job.file_url) return
    save(job.file_url, job.file_name)
    if (job.truncated) toast.warning(__('Only the first {0} rows were exported.', [job.rows]))
  }

  /** Hand this an export endpoint's `{ job, status }`; an answer with no job (a refusal) is left alone. */
  function track(queued) {
    if (!queued?.job) return false
    whenDone(queued.job, saveIfReady)
    toast.info(__('Preparing your export…'), { action: { label: __('View'), onClick: openPanel } })
    return true
  }

  // frappe's own System Settings ceiling, already on the client in the boot's sysdefaults; every export surface states the same number.
  const rowLimit = computed(() => Number(window.sysdefaults?.max_report_rows) || 100000)

  return { rowLimit, track }
})
