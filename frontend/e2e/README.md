# E2E (Playwright) — runbook

End-to-end tests that drive a **real browser** against a **live CRM bench**. Unlike the unit/component
suites (which run in Node with no backend), these need a running app + a real login, so they are
**local-first** and **never** run on push CI — only the manual `E2E` workflow (`workflow_dispatch`).

## What it covers
- `smoke.spec.js` — authenticated boot, lands on Leads.
- `routes.spec.js` (E1) — key routes mount without a login bounce or not-permitted page.
- `smart-views.spec.js` (E2) — create a Smart View through the editor; it persists and becomes active (desktop).
- `mobile-sheet.spec.js` — the Smart View switcher renders as a bottom sheet on a phone viewport.

## Framework
- `config.js` — all env-derived config (no hardcoded/fabricated values).
- `global-setup.js` — logs in once via the API, captures the cookie session **and** the CSRF token; saves both to `e2e/.auth/` (gitignored).
- `fixtures.js` — extends Playwright with `api` (authed REST client for setup/teardown) and `smartViews` (page object). **UI drives the flow under test; the API handles preconditions and cleanup** so a failed UI step never leaves the bench dirty.
- `pages/smartViews.js` — Smart Views page object; selectors are role/label/text based and grounded in the real components.

## Required environment
| Var | Required | Meaning |
|---|---|---|
| `E2E_BASE_URL` | yes | Origin of the running CRM (the **bench**, e.g. `https://uat.example.com` — not the vite dev server, so `/api` and `/login` resolve). Defaults to `http://localhost:8080`. |
| `E2E_USER` / `E2E_PASSWORD` | yes | Login for the run. Must be able to create a Smart View with **no manual grain pick** — i.e. a **single-grain** user (grain auto-applies) or a **System Manager**. Never commit these. |
| `E2E_LEAD` | optional | A seeded lead `name`; enables the lead-detail route test. Skipped if unset. |

## Run it
```bash
cd frontend
yarn e2e:install                 # one-time: install the chromium binary
export E2E_BASE_URL=...          # your running bench
export E2E_USER=... E2E_PASSWORD=...
yarn e2e                         # all specs, desktop + mobile projects
yarn e2e --project=desktop       # one project
yarn e2e:ui                      # watch/debug mode
```
On failure, Playwright writes a trace + screenshot under `playwright-report/` — open it with
`npx playwright show-report`.

## First-run notes (these were grounded against source but not yet run against a live DOM)
- The mobile-sheet trigger has no dedicated label; the test targets it by the active view's label. If the
  collapsed trigger renders differently, that locator is the first thing to adjust (`pages/smartViews.js`).
- The Smart View create flow assumes the editor's 3 steps and a no-grain-pick user (see env table). A
  multi-grain manager would need a grain selection step added.
