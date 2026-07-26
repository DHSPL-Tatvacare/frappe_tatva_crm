// One staging brain for a note/task modal's files — the separate Attach button AND the rich editor's
// inline Image/Video/Embed feed the SAME list. Nothing hits the backend until Save; on Save every staged
// file is uploaded through the app's own FilesUploadHandler with {doctype, docname, private} so each File
// is born OWNED by the note/task (M1) and our Azure hooks offload it — never an unowned private orphan.
// Inline media stages a local object-URL preview and, on upload, hands back the local->proxy URL rewrite
// so the persisted content points at the owned file, not the dead blob URL.
import { computed, ref } from 'vue'
import FilesUploadHandler from '@/components/FilesUploader/filesUploaderHandler'

export function useStagedAttachments() {
  // Each entry: { file, inline, previewUrl }. inline=true came from the editor (has an object-URL preview).
  const staged = ref([])

  // The separate-Attach list shows only non-inline files (inline media lives in the editor itself).
  const attachFiles = computed(() => staged.value.filter((s) => !s.inline))
  const hasStaged = computed(() => staged.value.length > 0)

  // Separate Attach button: stage a picked File as-is.
  function stageAttach(file) {
    staged.value = [...staged.value, { file, inline: false, previewUrl: null }]
  }

  // frappe-ui TextEditor uploadFunction: stage the inline file, return its local preview as file_url so
  // the editor shows it immediately WITHOUT any backend write; the real upload happens on Save.
  function stageInline(file) {
    const previewUrl = URL.createObjectURL(file)
    staged.value = [...staged.value, { file, inline: true, previewUrl }]
    return Promise.resolve({ file_url: previewUrl })
  }

  function unstageAttach(item) {
    staged.value = staged.value.filter((s) => s !== item)
  }

  // On Save: upload every staged file OWNED by the saved record; return {localUrl: proxyUrl} for inline
  // media so the caller can rewrite the editor content before persisting it.
  async function uploadAllOwned({ doctype, docname }) {
    const rewrites = {}
    for (const item of staged.value) {
      const res = await new FilesUploadHandler().upload(item.file, {
        fileObj: item.file,
        private: true,
        folder: 'Home',
        doctype,
        docname,
      })
      const fileUrl = res?.file_url || res?.message?.file_url
      if (item.inline && item.previewUrl && fileUrl)
        rewrites[item.previewUrl] = fileUrl
    }
    return rewrites
  }

  // Swap every local preview URL in the content for its returned owned proxy URL.
  function rewriteInline(content, rewrites) {
    let out = content || ''
    for (const [local, url] of Object.entries(rewrites || {}))
      out = out.split(local).join(url)
    return out
  }

  return {
    staged,
    attachFiles,
    hasStaged,
    stageAttach,
    stageInline,
    unstageAttach,
    uploadAllOwned,
    rewriteInline,
  }
}
