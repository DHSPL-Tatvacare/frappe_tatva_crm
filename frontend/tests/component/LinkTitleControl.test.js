// Purpose: the Link control must show a Link's title, not its composite `::` PK. It reads the SAME per-doc `_link_titles` map Field.vue reads (provided by FieldLayout / SidePanelLayout via inject); with the map it titles the closed display, without it (off a doc) it falls back to the raw value. On the pre-fix control the side panel showed `Zydus-Liver-Forever::Onboarding`.
import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { mountTatva } from './_mount.js'
import { mockFrappeMethod } from './_msw.js'
import Link from '@/components/Controls/Link.vue'

const DOCTYPE = 'CRM Lead Stage'
const PK = 'Zydus-Liver-Forever::Onboarding'
const TITLE = 'Onboarding'

function mountLink(linkTitles) {
  mockFrappeMethod('frappe.desk.search.search_link', [])
  return mountTatva(Link, {
    props: { doctype: DOCTYPE, value: PK },
    global: { provide: linkTitles ? { linkTitles } : {} },
  })
}

describe('Controls/Link — resolves the closed display from the injected linkTitles', () => {
  beforeEach(() => delete window.translated_doctypes)

  it('with the map: shows the title, never the :: PK', async () => {
    const w = mountLink(ref({ [`${DOCTYPE}::${PK}`]: TITLE }))
    await flushPromises()
    expect(w.text()).toContain(TITLE)
    expect(w.text()).not.toContain('::')
  })
})
