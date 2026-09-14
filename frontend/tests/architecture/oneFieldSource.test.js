// ONE answer to "what fields does this list have", and a test that makes a second one unshippable.
//
// THE DEFECT THIS EXISTS FOR. The SPA has two ways to learn a doctype's fields: the server lens (which
// honours what each field says about itself — its name, and whether a reader may see it) and the browser's
// doctype-meta store, which knows none of that and carries upstream's hardcoded names for the columns that
// have no field. Every list menu was meant to use the first. The quick-filter picker used the second, so it
// went on offering Provider Call ID and Workflow Correlation under names no other menu used — found by
// looking at the screen, not by any test, after the same class of bug had been "fixed" three times.
//
// The point is not that those call sites are correct today. It is that a fourth one cannot be added quietly.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src')
const read = (p) => readFileSync(resolve(SRC, p), 'utf8')

// The surfaces that answer "which fields may I filter, sort, group, or show as a column". Each is a menu a
// reader opens on a list; none of them may ask the browser what fields exist.
const LIST_MENUS = [
  'components/Filter.vue',
  'components/SortBy.vue',
  'components/GroupBy.vue',
  'components/ViewControls.vue',
]

// The two that take the lens as a prop and keep upstream's meta fallback for apps that pass nothing. Ours
// must always pass it, or the fallback wakes up and the second source is back.
const LENS_FED = {
  'components/ColumnSettings.vue': 'fieldSource',
  'components/Kanban/KanbanSettings.vue': 'fieldSource',
}

describe('one field source for every list menu', () => {
  for (const file of LIST_MENUS) {
    it(`${file} asks the server lens, never the browser's doctype meta`, () => {
      expect(read(file)).not.toMatch(/getFields\s*\(/)
    })
  }

  for (const [file, prop] of Object.entries(LENS_FED)) {
    it(`${file} is handed the lens by ViewControls, so its meta fallback stays unreachable`, () => {
      // It is allowed to KEEP the fallback — that is upstream's file — but ours must never reach it.
      const tag = file.split('/').pop().replace('.vue', '')
      const controls = read('components/ViewControls.vue')
      const mount = controls.match(new RegExp(`<${tag}[\\s\\S]*?/?>`))
      expect(mount, `${tag} is not mounted by ViewControls any more — this test needs rewriting`).toBeTruthy()
      expect(mount[0]).toMatch(new RegExp(`:${prop}\\s*=`))
    })
  }

  it('the lens answers every doctype, so the fallback is never the one that speaks', () => {
    // An empty answer is ColumnSettings' own contract for "read doctype meta instead". The server-side
    // counterpart of this is locked in tests/tasks/test_list_lenses.py; this half proves the client still
    // asks for it rather than quietly dropping the prop.
    expect(read('components/ViewControls.vue')).toMatch(/task_lenses\.get_column_fields/)
  })
})
