// Absence renders nothing, the operator's HTML reaches the DOM only through `sanitizeHTML` (asserted as a CALL: DOMPurify no-ops under happy-dom; nh3 on the server is the proven gate), and dismissal keys on the notice id.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountTatva } from './_mount.js'
import { sanitizeHTML } from '@/utils'
import TatvaBanner from '@/tatva/TatvaBanner.vue'

vi.mock('@/utils', () => ({ sanitizeHTML: vi.fn((html) => `[clean]${html}`) }))

const notice = (html, id) => ({ html, id })

beforeEach(() => {
  localStorage.clear()
  delete window.tatva_banner
  vi.mocked(sanitizeHTML).mockClear()
})

describe('absence', () => {
  it('renders nothing when the server published no notice', () => {
    expect(mountTatva(TatvaBanner).html()).toBe('<!--v-if-->')
  })

  it('renders nothing for an empty or malformed key', () => {
    for (const bad of [
      {},
      { html: '<b>x</b>' },
      { id: 'abc' },
      { html: '', id: '' },
    ]) {
      window.tatva_banner = bad
      expect(mountTatva(TatvaBanner).find('button[aria-label]').exists()).toBe(
        false,
      )
    }
  })
})

describe('the notice', () => {
  it('shows the operator’s message', () => {
    window.tatva_banner = notice('<b>Upgrade</b> tonight', 'abc123')
    expect(mountTatva(TatvaBanner).text()).toContain('Upgrade tonight')
  })

  it('renders only what the sanitiser returned, under the tag allowlist', () => {
    window.tatva_banner = notice(
      '<img src=x onerror="window.__pwned = 1">',
      'abc123',
    )
    const w = mountTatva(TatvaBanner)

    expect(sanitizeHTML).toHaveBeenCalledWith(
      '<img src=x onerror="window.__pwned = 1">',
      expect.objectContaining({
        ALLOWED_TAGS: expect.not.arrayContaining(['img', 'script']),
      }),
    )
    expect(w.html()).toContain('[clean]')
    expect(window.__pwned).toBeUndefined()
  })
})

describe('dismissal', () => {
  it('hides on dismiss and stays hidden on the next mount', async () => {
    window.tatva_banner = notice('Upgrade tonight', 'abc123')

    const w = mountTatva(TatvaBanner)
    await w.find('button[aria-label]').trigger('click')
    expect(w.find('button[aria-label]').exists()).toBe(false)
    expect(mountTatva(TatvaBanner).find('button[aria-label]').exists()).toBe(
      false,
    )
  })

  it('comes back when the operator edits the notice', async () => {
    window.tatva_banner = notice('Upgrade tonight', 'abc123')
    const w = mountTatva(TatvaBanner)
    await w.find('button[aria-label]').trigger('click')

    window.tatva_banner = notice('Upgrade tomorrow', 'def456')
    expect(mountTatva(TatvaBanner).text()).toContain('Upgrade tomorrow')
  })
})
