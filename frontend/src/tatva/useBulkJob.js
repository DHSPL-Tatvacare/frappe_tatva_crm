import { call, toast } from 'frappe-ui'
import { whenDone, openPanel, queuedText } from '@/stores/bulkActionsPanel'

// TATVA: THE door for every list action (Assign, Clear Assignment, Reassign, Bulk Edit, Bulk Delete); the Bulk Actions store owns what happens after.

export function useBulkJob() {
  // `onDone(job)` runs in this tab when the job ends, for the caller's own list reload; the finish toast is the store's.
  async function runOrQueue(action, doctype, docnames, params, onDone) {
    const names = Array.isArray(docnames) ? docnames : Array.from(docnames)
    const result = await call('tatva_connect.bulk_actions.run_or_queue', {
      action,
      doctype,
      docnames: JSON.stringify(names),
      params: JSON.stringify(params || {}),
    })
    if (!result.job) {
      // The seam always queues; an answer with no job is a server that cannot be watched, not a wait.
      throw new Error(__('The action did not start. Please try again.'))
    }
    whenDone(result.job, onDone)
    toast.info(queuedText(action, doctype, names.length), { action: { label: __('View'), onClick: openPanel } })
    return result
  }

  // THE delete door for every surface, the list's selection and a record's own header alike.
  async function deleteRecords(doctype, names, deleteLinked, onDone) {
    try {
      return await runOrQueue('Bulk Delete', doctype, names, { delete_linked: deleteLinked }, onDone)
    } catch (e) {
      toast.error(e?.messages?.[0] || __('Could not delete'))
      throw e
    }
  }

  return { runOrQueue, deleteRecords }
}
