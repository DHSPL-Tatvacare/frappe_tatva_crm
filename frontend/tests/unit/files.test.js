// Purpose: pin displayFileName — the ONE helper resolving a clean attachment name from either an
// Azure-proxy URL (real name in the file_name= query param) or a plain Frappe /files path.
import { displayFileName } from '@/tatva/files'

describe('displayFileName', () => {
  it('returns empty string for nullish / empty input', () => {
    expect(displayFileName('')).toBe('')
    expect(displayFileName(null)).toBe('')
    expect(displayFileName(undefined)).toBe('')
  })

  it('takes the basename from a plain public /files path', () => {
    expect(displayFileName('/files/foo.png')).toBe('foo.png')
  })

  it('takes the basename from a /private/files path', () => {
    expect(displayFileName('/private/files/x.pdf')).toBe('x.pdf')
  })

  it('strips a leading hex blob-key hash prefix from the basename', () => {
    expect(displayFileName('/files/a1b2c3d4_Report.pdf')).toBe('Report.pdf')
  })

  it('resolves the real name from an Azure-proxy file_name= query param (URL-decoded)', () => {
    const blobKey = '9f8e7d6c5b4a_Lab%20Report.pdf'
    const url =
      'https://host/api/method/tatva_connect.api.storage.proxy?file_name=' +
      encodeURIComponent(blobKey)
    expect(displayFileName(url)).toBe('Lab Report.pdf')
  })

  it('strips a trailing query string and #hash from a path-form URL', () => {
    expect(displayFileName('/files/foo.png?v=2#frag')).toBe('foo.png')
  })
})
