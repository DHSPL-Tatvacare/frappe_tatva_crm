import { defineConfig, devices } from '@playwright/test'

// E2E runs against a LIVE bench (the app + Frappe API must already be up). Everything is env-driven so
// no URL or credential is ever committed (S.5):
//   E2E_BASE_URL  origin the CRM app is served from (default: vite dev server)
//   E2E_USER / E2E_PASSWORD  login used once in global-setup to mint an auth storageState
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8080'

export default defineConfig({
  testDir: './e2e',
  // Auth once, reuse the cookie for every spec (no per-test UI login).
  globalSetup: './e2e/global-setup.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    storageState: 'e2e/.auth/state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // ~393px — enforces the mobile-first invariant (C.19) and the bottom-sheet path (C.20/C.22).
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
})
