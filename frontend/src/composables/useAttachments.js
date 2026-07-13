import { createResource } from 'frappe-ui'

const pendingDeletionsMap = new Map()

export function useAttachments(doctype, docname) {
  const key = `${doctype}::${docname}`
  if (!pendingDeletionsMap.has(key)) {
    pendingDeletionsMap.set(key, new Set())
  }
  const pending = pendingDeletionsMap.get(key)

  function trackOldFile(oldValue, newValue) {
    if (isFileUrl(oldValue) && oldValue !== newValue) {
      pending.add(oldValue)
    }
  }

  function processPendingDeletions() {
    if (!pending.size) return
    pending.forEach((file_url) => deleteFileRecord(doctype, docname, file_url))
    pending.clear()
    pendingDeletionsMap.delete(key)
  }

  return { trackOldFile, processPendingDeletions }
}

// A file we own — local OR offloaded. The two /files prefixes alone missed every offloaded file, so
// isFileUrl() was always false, trackOldFile() never queued anything, and a replaced image left its
// File row and its Azure blob behind for ever.
export function isFileUrl(v) {
  return (
    typeof v === 'string' &&
    (v.startsWith('/files/') ||
      v.startsWith('/private/files/') ||
      v.startsWith('/api/method/tatva_connect.storage.api.download_file'))
  )
}

function deleteFileRecord(doctype, docname, file_url) {
  createResource({
    url: 'crm.api.delete_attachment',
    params: { doctype, docname, file_url },
    auto: true,
    onError: (e) => console.error('Failed to delete file attachment', e),
  })
}
