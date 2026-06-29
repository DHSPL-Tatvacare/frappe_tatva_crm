// E2 — the Smart View create lifecycle end-to-end (our most custom surface, A.17): open the editor,
// author a view, and assert it persists and becomes the active tab. Desktop only (mobile uses the sheet,
// covered separately). Cleanup goes through the API so a failed UI step never leaves the bench dirty.
import { test, expect, uniqueName, deleteViewViaApi } from './fixtures.js'

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop-only lifecycle (mobile sheet is separate)')
})

test('create a Smart View through the editor — it persists and becomes active', async ({
  page,
  smartViews,
  api,
}) => {
  const label = uniqueName()
  let createdName = ''
  try {
    await smartViews.goto()
    await smartViews.createView(label)
    await expect(smartViews.tab(label)).toBeVisible() // shows in the strip
    createdName = smartViews.activeViewName() // and is the active :view in the URL
    expect(createdName).not.toBe('')
  } finally {
    if (createdName) await deleteViewViaApi(api, createdName)
  }
})
