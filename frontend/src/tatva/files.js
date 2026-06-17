// Shared file-name display helper for activity attachments.
//
// Azure-proxy file URLs carry the real name in the `file_name=` query param (a blob key whose
// basename is '<hash>_RealName.ext'); the URL PATH only ends in the proxy method name. Plain Frappe
// URLs (/files/foo.png, /private/files/x.pdf) carry the name in the path. Resolve both to a clean name.
export function displayFileName(url) {
  if (!url) return ''
  const m = /[?&]file_name=([^&]+)/.exec(url)
  let source = url
  if (m) {
    try {
      source = decodeURIComponent(m[1])
    } catch {
      source = m[1]
    }
  }
  let raw = source.split('?')[0].split('#')[0].split('/').pop() || url
  raw = raw.replace(/^[a-f0-9]{8,}_/i, '') // strip the blob-key hash prefix
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
