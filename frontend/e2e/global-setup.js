// Mint an authenticated session ONCE for the whole run: log in via the Frappe API, then open the app in
// a browser to capture the CSRF token the app exposes (window.csrf_token) — writes through the REST API
// need it. Persists the cookie storageState + the token; specs and the api fixture reuse both. Nothing
// is committed (S.5) — credentials come from env (E2E_USER / E2E_PASSWORD).
import { request, chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { BASE_URL, STORAGE_STATE, CSRF_FILE, requireEnv } from './config.js'

export default async function globalSetup() {
  const usr = requireEnv('E2E_USER')
  const pwd = requireEnv('E2E_PASSWORD')

  // 1) Log in over the API → the context now holds the `sid` session cookie.
  const api = await request.newContext({ baseURL: BASE_URL })
  const res = await api.post('/api/method/login', { form: { usr, pwd } })
  if (!res.ok()) {
    throw new Error(`E2E login failed (${res.status()}) for ${usr} at ${BASE_URL}. Check creds / bench is up.`)
  }
  const state = await api.storageState()
  await api.dispose()

  // 2) Open the app with that session and read the CSRF token the boot injects on window.
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ baseURL: BASE_URL, storageState: state })
  const page = await ctx.newPage()
  await page.goto('/crm')
  const csrf = await page.evaluate(() => window.csrf_token || '')
  await browser.close()

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true })
  fs.writeFileSync(STORAGE_STATE, JSON.stringify(state))
  fs.writeFileSync(CSRF_FILE, JSON.stringify({ csrf }))
}
