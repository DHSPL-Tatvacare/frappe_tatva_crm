// Purpose: no worklist offers Import. Loading records from a spreadsheet writes rows with no per-row automation, no grain clamp and no undo, so it belongs in Desk where frappe's own two gates apply — `allow_import` on the DocType (refused BEFORE any permission check, and a System Manager does NOT bypass it) and the `import` DocPerm — and `tatva_connect.access.lockdown.IMPORT_OFF` turns that flag off for every listed doctype except CRM Lead, whose bulk load is the one the business runs. The button lived in ONE place, `ViewControls`' overflow menu, which is why every list page in the SPA carried it (the workflow runs page included, where Data Import would have refused the doctype anyway); deleting it once is the whole fix, and this lock is what stops it being re-added to a single page later. Export is deliberately untouched: it reads.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const SRC = path.resolve(process.cwd(), 'src')

// The route declarations themselves, and the page they name — reachable by URL and still gated by the two server checks; what must not exist is a worklist HANDING a user to it.
const ALLOWED = new Set(['router.js', path.join('pages', 'DataImport.vue')])

function walk(dir) {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(full))
    else if (/\.(vue|js)$/.test(entry.name)) found.push(full)
  }
  return found
}

const files = walk(SRC)

describe('no Import affordance on a worklist', () => {
  it('scanned a real tree — a source lock that found nothing must prove it looked', () => {
    // Without this the whole file passes vacuously the day SRC resolves somewhere with no components.
    expect(files.length).toBeGreaterThan(200)
    expect(
      files.some((f) =>
        f.endsWith(path.join('components', 'ViewControls.vue')),
      ),
    ).toBe(true)
  })

  it('nothing but the route table and the page itself names the import routes', () => {
    const offenders = files.filter((file) => {
      const rel = path.relative(SRC, file)
      if (ALLOWED.has(rel)) return false
      return /NewDataImport|DataImportList/.test(fs.readFileSync(file, 'utf8'))
    })
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([])
  })

  it('the shared list toolbar still offers Export, so this is a removal and not a blanket', () => {
    const toolbar = fs.readFileSync(
      path.join(SRC, 'components/ViewControls.vue'),
      'utf8',
    )
    expect(toolbar).toContain("__('Export')")
    expect(toolbar).not.toContain("__('Import')")
  })
})
