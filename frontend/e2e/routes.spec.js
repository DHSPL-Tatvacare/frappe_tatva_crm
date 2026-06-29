// E1 — every key route mounts the SPA without bouncing to login or the not-permitted page. A cheap guard
// that a broken bundle / route / permission default can't silently ship a dead screen.
import { test, expect } from './fixtures.js'
import { SEEDED_LEAD } from './config.js'

const routes = [
  ['/crm/leads/view', 'Leads list'],
  ['/crm/smart-views', 'Smart Views'],
  ['/crm/tasks/view', 'Tasks list'],
]

for (const [path, label] of routes) {
  test(`route loads: ${label}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('#app')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page).not.toHaveURL(/not-permitted/)
  })
}

test('a seeded lead detail opens', async ({ page }) => {
  test.skip(!SEEDED_LEAD, 'set E2E_LEAD to a seeded lead name to run this')
  await page.goto(`/crm/leads/${SEEDED_LEAD}`)
  await expect(page.locator('#app')).toBeVisible()
  await expect(page).not.toHaveURL(/not-permitted/)
})
