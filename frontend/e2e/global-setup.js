// Mint an authenticated session ONCE and persist it for every spec. Logs in through the Frappe API
// (POST /api/method/login sets the `sid` cookie) using env credentials — nothing is committed (S.5).
import { request } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const STATE = path.join('e2e', '.auth', 'state.json')

export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8080'
  const usr = process.env.E2E_USER
  const pwd = process.env.E2E_PASSWORD
  if (!usr || !pwd) {
    throw new Error(
      'E2E auth needs E2E_USER and E2E_PASSWORD (and optionally E2E_BASE_URL). ' +
        'Set them in your shell before running `yarn e2e` — never commit them.',
    )
  }

  const ctx = await request.newContext({ baseURL })
  const res = await ctx.post('/api/method/login', { form: { usr, pwd } })
  if (!res.ok()) {
    throw new Error(`Login failed (${res.status()}) for ${usr} at ${baseURL}. Check creds / bench is up.`)
  }

  fs.mkdirSync(path.dirname(STATE), { recursive: true })
  await ctx.storageState({ path: STATE })
  await ctx.dispose()
}
