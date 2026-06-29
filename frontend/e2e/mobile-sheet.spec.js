// E1/mobile — on a phone viewport the Smart View switcher is a bottom SHEET (TatvaBottomSheet: role=dialog,
// bottom-anchored, rounded-t-2xl), never the desktop tab strip (C.19/C.20/C.22). The sheet only renders
// when ≥1 view exists, so provision one via the API and navigate to it so it's the active trigger label.
import { test, expect, uniqueName, createViewViaApi, deleteViewViaApi } from './fixtures.js'

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only sheet (desktop uses the tab strip)')
})

test('the Smart View switcher opens as a bottom sheet on mobile', async ({ page, smartViews, api }) => {
  const label = uniqueName('E2E Sheet')
  const view = await createViewViaApi(api, label)
  try {
    await smartViews.goto(view.name) // make our view the active one → its label is the trigger
    const sheet = await smartViews.openMobileSheet(label)
    await expect(sheet).toHaveClass(/rounded-t-2xl/) // bottom sheet, not a centered dialog
    await expect(sheet).toContainText('Smart Views') // the sheet's title
  } finally {
    await deleteViewViaApi(api, view.name)
  }
})
