// The E2E framework's base `test`/`expect`. Extends Playwright with:
//   • api          — an authed REST client (session cookie + CSRF) for fast, reliable setup/teardown,
//                    so UI tests don't depend on the UI to provision or clean up their fixtures.
//   • smartViews   — the Smart Views page object (selectors live in pages/smartViews.js).
// UI drives the flow under test; the api fixture handles preconditions and cleanup.
import { test as base, expect, request } from '@playwright/test'
import fs from 'node:fs'
import { BASE_URL, STORAGE_STATE, CSRF_FILE } from './config.js'
import { SmartViewsPage } from './pages/smartViews.js'

const csrf = () => JSON.parse(fs.readFileSync(CSRF_FILE, 'utf8')).csrf

export const test = base.extend({
  api: async ({}, use) => {
    const ctx = await request.newContext({
      baseURL: BASE_URL,
      storageState: STORAGE_STATE,
      extraHTTPHeaders: { 'X-Frappe-CSRF-Token': csrf() },
    })
    // Call a whitelisted method and return its unwrapped `message`, throwing on a non-2xx.
    const call = async (method, body) => {
      const r = await ctx.post(`/api/method/${method}`, { data: body })
      if (!r.ok()) throw new Error(`api ${method} failed (${r.status()}): ${await r.text()}`)
      return (await r.json()).message
    }
    await use({ ctx, call })
    await ctx.dispose()
  },

  smartViews: async ({ page }, use) => {
    await use(new SmartViewsPage(page))
  },
})

export { expect }

// Unique, readable label so parallel/repeat runs never collide and any leftover is traceable to E2E.
export const uniqueName = (prefix = 'E2E View') => `${prefix} ${Date.now().toString(36)}`

// Provision/clean a Smart View directly through the backend (the same endpoints the editor uses).
export const createViewViaApi = (api, label) =>
  api.call('tatva_connect.smartview.api.upsert_view', { view: { label, base_object: 'Lead' } })
export const deleteViewViaApi = (api, name) =>
  api.call('tatva_connect.smartview.api.delete_view', { name })
