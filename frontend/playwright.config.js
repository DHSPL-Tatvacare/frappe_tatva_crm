import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, STORAGE_STATE } from './e2e/config.js'

// E2E runs against a LIVE bench (the app + Frappe API must already be up). All env-derived config lives
// in e2e/config.js; auth is minted once in global-setup. See e2e/README.md.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    storageState: STORAGE_STATE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // ~393px — enforces the mobile-first invariant (C.19) and the bottom-sheet path (C.20/C.22).
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
})
