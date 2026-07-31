// Purpose: lock 4 of the list-view-cleanup plan. `_link_titles` is the framework's map of a Link's human
// title, and exactly ONE file in the frontend may read it: `tatva/linkTitle.js`. Notes.vue grew its own
// read of the same map — a second brain — and with it a private column list and a same-tab button. This
// is the check that would have caught that the day it was written.
//
// Comments are prose, not a reader: several files legitimately NAME the map while explaining why they
// defer to the one reader. They are blanked (not deleted) so reported line numbers stay true.
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(process.cwd(), 'src')
const READER = 'tatva/linkTitle.js'

function stripComments(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)))
}

// The map, not any identifier ENDING in it: `list_link_titles` is the server module that BUILDS the map,
// and naming that endpoint is how a caller defers to the one reader rather than a second read of it.
const READS_THE_MAP = /(^|[^\w])_link_titles/

function sourceFiles(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...sourceFiles(p))
    else if (/\.(vue|js|ts)$/.test(e.name)) out.push(p)
  }
  return out
}

describe('one _link_titles reader', () => {
  it('no file under src/ but tatva/linkTitle.js reads the map', () => {
    const files = sourceFiles(SRC)
    const offenders = []
    let readerHits = 0
    for (const file of files) {
      const rel = path.relative(SRC, file)
      const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n')
      lines.forEach((line, i) => {
        if (!READS_THE_MAP.test(line)) return
        if (rel === READER) readerHits += 1
        else offenders.push(`${rel}:${i + 1}: ${line.trim()}`)
      })
    }
    // Coverage first: a source-scanning lock that scanned nothing passes vacuously with a real violation
    // present, and the comment-stripper is exactly the thing that could silently blank everything.
    expect(files.length).toBeGreaterThan(100)
    expect(readerHits).toBeGreaterThan(0)
    expect(offenders).toEqual([])
  })

  // That the reader ANSWERS a Dynamic Link is asserted on its behaviour, in tests/unit/linkTitle.test.js.
  it('the Notes page no longer keeps a private column list', () => {
    const src = fs.readFileSync(path.join(SRC, 'pages/Notes.vue'), 'utf8')
    expect(src).not.toContain('DEFAULT_NOTE_COLUMNS')
  })
})
