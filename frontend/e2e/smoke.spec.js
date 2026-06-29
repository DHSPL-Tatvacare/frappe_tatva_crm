import { test, expect } from '@playwright/test'

// Purpose: the app boots AUTHENTICATED into the CRM SPA and is not bounced to login. Lowest-cost,
// highest-signal E2E — catches build, routing, and session regressions before anything ships.
test('authenticated app shell loads at /crm', async ({ page }) => {
  await page.goto('/crm')
  // Arrived via the saved storageState → no login form should be present.
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  // The SPA mounted.
  await expect(page.locator('#app')).toBeVisible()
  expect(page.url()).toContain('/crm')
})
