// Purpose: the mobile layer order is a DECLARED contract, not a set of numbers each component invents.
// It exists because a delete confirmation opened BEHIND a bottom sheet: reka portals dialog and popover
// content to <body> at `z-index: auto`, which loses to the sheet's z-50, and frappe-ui ships
// `.dialog-overlay` with no z-index at all. The remedy lives once, in TatvaBottomSheet's style block.
// This test is the enforcement — without it the order is a comment, and the next `z-[9999]` at a call
// site silently outranks a destructive prompt again. The bands are documented in TatvaBottomSheet.vue.
import fs from 'node:fs'
import path from 'node:path'

// process.cwd() is the vitest root (frontend/). `__dirname` is undefined under ESM, which resolved SRC to
// a directory holding no .vue files — the scan found nothing and the lock passed vacuously with a real
// violation present. A source-scanning lock must prove it scanned; see the coverage assertions below.
const SRC = path.resolve(process.cwd(), 'src')
const SHEET = path.join(SRC, 'tatva/TatvaBottomSheet.vue')

// band -> what lives there. Anything outside this set is an undeclared layer.
const BANDS = {
  0: 'flow / reset',
  1: 'decoration inside a card',
  10: 'sticky inside a panel',
  20: 'app chrome',
  40: 'sheet backdrop',
  50: 'sheet / spotlight',
  60: 'portaled popover content',
  100: 'Popover',
  110: 'dialog overlay',
}

// Comments are prose, not layers. Blanked (not deleted) so reported line numbers stay true — without this
// the lock flagged the very comment that explains a value it had removed.
function stripComments(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)))
}

function vueFiles(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...vueFiles(p))
    else if (e.name.endsWith('.vue')) out.push(p)
  }
  return out
}

describe('mobile layer order', () => {
  it('every z-index in a template is one of the declared bands', () => {
    const files = vueFiles(SRC)
    const offenders = []
    let seen = 0
    for (const file of files) {
      const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n')
      lines.forEach((line, i) => {
        // Tailwind forms: z-50, z-[100], -z-[1]
        // `\b` sits ONLY on the bare-number branch: after `]` both chars are non-word, so a trailing \b
        // never matches and every z-[N] — the dangerous form — was invisible to this scan.
        for (const m of line.matchAll(/-?\bz-(?:\[(\d+)\]|(\d+)\b)/g)) {
          const n = Number(m[1] ?? m[2])
          seen += 1
          if (!(n in BANDS)) {
            offenders.push(`${path.relative(SRC, file)}:${i + 1}: z-${n}`)
          }
        }
      })
    }
    // Coverage first: without these the lock passes when it scanned nothing, which is how it shipped green
    // while a z-[9999] sat in NearMe.vue.
    expect(files.length).toBeGreaterThan(100)
    expect(seen).toBeGreaterThan(10)
    expect(offenders).toEqual([])
  })

  it('the sheet sits at the top of the APP layer, not above dialogs', () => {
    const src = fs.readFileSync(SHEET, 'utf8')
    expect(src).toMatch(/z-40[^\n]*bg-black/) // backdrop below the sheet
    expect(src).toMatch(/fixed inset-x-0 bottom-0 z-50/) // the sheet itself
  })

  it('portaled dialogs and popovers are raised above the sheet, on mobile only', () => {
    const src = fs.readFileSync(SHEET, 'utf8')
    const media = src.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/)
    expect(media, 'the narrow-viewport block must exist').toBeTruthy()
    const block = media[1]
    const popover = Number((block.match(/\[data-reka-popper-content-wrapper\]\s*\{\s*z-index:\s*(\d+)/) || [])[1])
    const dialog = Number((block.match(/\.dialog-overlay\s*\{\s*z-index:\s*(\d+)/) || [])[1])
    expect(popover, 'portaled popover band').toBe(60)
    expect(dialog, 'dialog overlay band').toBe(110)
    // A confirmation must outrank the sheet AND every popover, or it can open behind one.
    expect(dialog).toBeGreaterThan(50)
    expect(dialog).toBeGreaterThan(100)
    expect(dialog).toBeGreaterThan(popover)
  })
})
