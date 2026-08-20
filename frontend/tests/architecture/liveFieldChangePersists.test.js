// Purpose: lock the defect that let a rep move a lead's stage for two months and keep nothing.
//
// `triggerOnChange` (data/document.js) does NOT save. It mutates the cached doc and runs the field's
// form scripts; persistence is a SECOND, unrelated call. A modal or a grid row defers that save on
// purpose — the dialog's own button writes the whole doc. A LIVE surface has no such button, so a
// control that calls `triggerOnChange` and stops has written a change nobody keeps, with no error
// anywhere. That is exactly what the lead stage pill did from 2026-06-17 (44ab36d): it replaced a
// native dropdown whose handler ended in a save, and the save did not come with it.
//
// The rule: under src/pages/, a function that calls `triggerOnChange` must also persist — directly, or
// through one local helper that does (Deal's `setLostReason` is that shape and is correct).
// The one mechanism is `commitField`, which triggers, saves and rolls back in one place.
import fs from 'node:fs'
import path from 'node:path'

const PAGES = path.resolve(process.cwd(), 'src/pages')
const TRIGGER = /triggerOnChange\s*\(/g
const PERSISTS = /save\.submit\s*\(|commitField\s*\(/

function stripComments(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)))
}

// Every `function name(...) {` in the file, with the body its braces enclose.
function functions(src) {
  const out = []
  const decl = /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g
  let m
  while ((m = decl.exec(src))) {
    const open = src.indexOf('{', m.index + m[0].length - 1)
    let depth = 0
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}' && --depth === 0) {
        out.push({ name: m[1], start: open, end: i, body: src.slice(open, i + 1) })
        break
      }
    }
  }
  return out
}

// Directly, or via ONE local helper that does — the level of indirection a real handler legitimately uses.
function persists(fn, all) {
  if (PERSISTS.test(fn.body)) return true
  return all.some((o) => o !== fn && new RegExp(`\\b${o.name}\\s*\\(`).test(fn.body) && PERSISTS.test(o.body))
}

function vueFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? vueFiles(path.join(dir, e.name))
        : /\.vue$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    )
}

describe('a live field change persists', () => {
  it('no page mutates a field without saving it', () => {
    const offenders = []
    for (const file of vueFiles(PAGES)) {
      const src = stripComments(fs.readFileSync(file, 'utf8'))
      const fns = functions(src)
      TRIGGER.lastIndex = 0
      let hit
      while ((hit = TRIGGER.exec(src))) {
        const fn = fns.find((f) => hit.index > f.start && hit.index < f.end)
        const where = `${path.relative(PAGES, file)}:${src.slice(0, hit.index).split('\n').length}`
        if (!fn) offenders.push(`${where} — triggerOnChange outside any function`)
        else if (!persists(fn, fns)) offenders.push(`${where} — ${fn.name}() changes a field and never saves it`)
      }
    }
    expect(offenders).toEqual([])
  })
})
