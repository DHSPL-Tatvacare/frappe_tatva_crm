import { describe, it, expect } from 'vitest'
import { formatWhatsAppMessage } from '@/tatva/whatsappFormat.js'

function anchors(html) {
  const box = document.createElement('div')
  box.innerHTML = html
  return [...box.querySelectorAll('a')]
}

describe('formatWhatsAppMessage', () => {
  it('makes a link clickable, opening in a new tab without handing over the opener', () => {
    const [link] = anchors(formatWhatsAppMessage('Your report: https://example.com/r/a_b_c'))
    expect(link.getAttribute('href')).toBe('https://example.com/r/a_b_c')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('keeps underscores inside a link instead of reading them as italics', () => {
    const html = formatWhatsAppMessage('see https://example.com/a_b_c now')
    expect(html).not.toContain('<i>')
    expect(anchors(html)[0].textContent).toBe('https://example.com/a_b_c')
  })

  it('leaves a sentence full stop outside the link', () => {
    expect(anchors(formatWhatsAppMessage('Open https://example.com/x.'))[0].getAttribute('href')).toBe('https://example.com/x')
  })

  it('still applies the WhatsApp markup around a link', () => {
    const html = formatWhatsAppMessage('*Hello* visit www.example.org')
    expect(html).toContain('<b>Hello</b>')
    expect(anchors(html)[0].getAttribute('href')).toBe('http://www.example.org')
  })

  it('never lets a message inject markup or a script link', () => {
    const html = formatWhatsAppMessage('<img src=x onerror=alert(1)> javascript:alert(1)')
    expect(html).not.toContain('onerror')
    expect(anchors(html)).toHaveLength(0)
  })

  it('renders an empty body as nothing', () => {
    expect(formatWhatsAppMessage(null)).toBe('')
  })
})
