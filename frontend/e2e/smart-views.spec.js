import { test, expect } from '@playwright/test'

// Purpose: the Smart View engine is reachable from the list — the "Add view" affordance (aria-label
// "Add view", from SmartViewTabs) opens the editor dialog. This is our most custom surface (A.17) and
// the most likely to regress on an upstream rebase. Desktop strip only (mobile uses a sheet).
test.use({ viewport: { width: 1280, height: 800 } })

test('Add view opens the Smart View editor', async ({ page }) => {
  await page.goto('/crm/leads')
  const addView = page.getByRole('button', { name: 'Add view' })
  await expect(addView).toBeVisible()
  await addView.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
