import { test, expect, devices } from '@playwright/test'

// Purpose: on mobile (~393px) a modal surface renders as a bottom SHEET — TatvaBottomSheet's signature
// is role="dialog" anchored to the bottom with rounded top corners (rounded-t-2xl) — never a centered
// desktop dialog (C.19/C.20/C.22). The mobile Smart View control opens via the "All views" affordance.
test.use({ ...devices['Pixel 5'] })

test('a modal surface renders as a bottom sheet on mobile', async ({ page }) => {
  await page.goto('/crm/leads')
  const trigger = page.getByRole('button', { name: /all views/i })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await expect(sheet).toHaveClass(/rounded-t-2xl/) // bottom-sheet, not a centered dialog
})
