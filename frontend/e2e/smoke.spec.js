// Lowest-cost / highest-signal: the app boots AUTHENTICATED into the CRM SPA (no login bounce) and the
// root route lands on the Leads list. Catches build, session and routing regressions before anything else.
import { test, expect } from './fixtures.js'

test('boots authenticated into the CRM shell and lands on Leads', async ({ page }) => {
  await page.goto('/crm')
  await expect(page.locator('#app')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toHaveCount(0) // arrived via saved session
  await expect(page).toHaveURL(/\/crm\/leads/) // '/' redirects to the Leads list (router.js)
})
