// A thing that sits ON a surface must never carry that surface's own token, or it dissolves into it the
// moment the surface is active. This rule was broken and found by eye:
//   * the spotlight tile was `surface-gray-2`, the same token a hovered/selected row takes;
// The house already followed the rule elsewhere: ActivityCard rows hover to `gray-1` and its tiles are
// `gray-2`, one step apart. These assertions lock the rule rather than the two symptoms.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p) => readFileSync(resolve(import.meta.dirname, '../../src', p), 'utf8')

// Comments are PROSE and may quote a measured colour to explain why a token was chosen. Blank them
// (keeping length, so any line number stays true) before scanning for colour, or the scanner flags the
// explanation instead of the code. Same shape as oneTitleReader.test.js.
const code = (p) =>
  read(p)
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => ' '.repeat(m.length))

describe('surface layers', () => {
  it('the spotlight tile is not the token its row takes when hovered or selected', () => {
    const src = read('components/SearchResults.vue')
    const rowActive = src.match(/selected \? '(bg-surface-[\w-]+)'/)?.[1]
    const tile = src.match(/const NEUTRAL = '(bg-surface-[\w-]+)/)?.[1]
    expect(rowActive).toBeTruthy()
    expect(tile).toBeTruthy()
    expect(tile).not.toBe(rowActive)
  })

  it('the hover card is ONE fixed-width generic card, and the lead card only fills it', () => {
    expect(read('tatva/RecordCard.vue')).toMatch(/\bw-80\b/)
    expect(read('tatva/LeadPreview.vue')).toMatch(/<RecordCard/)
    expect(read('tatva/LeadPreview.vue')).not.toMatch(/<dl|<dt|<dd/)
  })

  // Colour comes from the DESIGN SYSTEM or not at all. `surface-*`, `ink-*` and `outline-*` are the three
  // semantic families frappe-ui themes; each resolves per light/dark mode. A hex, an rgb() or a raw
  // Tailwind palette step (`bg-blue-500`) is a colour that cannot follow the theme and is a defect here.
  it('uses only semantic design tokens — no hex, no rgb, no raw palette', () => {
    const RAW = /\b(?:bg|text|border|ring|fill|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/
    const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/
    for (const f of [
      'tatva/LeadPreview.vue',
      'tatva/LeadCell.vue',
      'tatva/RecordCard.vue',
      'components/SearchResults.vue',
    ]) {
      const src = code(f)
      expect(src, `${f} carries a raw palette colour`).not.toMatch(RAW)
      expect(src, `${f} carries a colour literal`).not.toMatch(LITERAL)
    }
  })
})
