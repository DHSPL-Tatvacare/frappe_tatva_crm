# CLAUDE.md

This repo is the **frontend** half of the TatvaCare CRM: a **lean fork of `frappe/crm`**
(Vue 3 + Vite + frappe-ui SPA), pinned at tag **`v1.73.2`**, branches **`develop` (work) → `uat` →
`prod` (deployed)**, public at `github.com/DHSPL-Tatvacare/frappe_tatva_crm`.

It does **not** stand alone. It is one of two repos that make one product:

| Repo | Is | Holds |
|---|---|---|
| **`frappe_tatva_crm`** (here) | the **UI** — what users see | Vue SPA: native screens + our additive `tatva/` components + thin guarded extension points |
| **`frappe_tatva_connect`** | the **brain** — a custom Frappe app (Python) | doctypes, `@frappe.whitelist()` endpoints, `doc_events`/hooks, all business logic & rules |

## The connection to `tatva_connect` — read this first

**This fork holds UI only. It holds NO business logic.** Every rule — permissions,
grain/entitlement, lead routing, WhatsApp/telephony routing, smart-view scoping,
automations, intake — lives in **`tatva_connect`** and is enforced **server-side,
fail-closed**. Our `tatva/` components and `// TATVA:` hooks are *dumb UI that calls
`tatva_connect`'s whitelisted endpoints* and renders the result.

- A new behaviour starts in `tatva_connect` (a whitelisted endpoint / hook), and this
  fork **consumes** it. The endpoint is the single source of truth; the screen is thin.
  Example: grain on Create Lead is `tatva_connect.access.entitlement.my_entitled_grains`
  + a `CRM Lead` `before_validate` clamp — the modal just reads the endpoint.
- **Defense in depth survives the fork.** A server-side fail-closed backstop in
  `tatva_connect` is the real guard; a broken/absent frontend hook can never let bad data
  save. Never move a rule *into* the fork to "make the UI simpler."
- The two ship **together** on one bench/site: `tatva_connect` baked into the prod image;
  this fork's frontend bundle built (`yarn build`) and served. Versions move in lockstep.

## Fork discipline (the rules that keep this lean)

1. **The fork is the LAST resort.** To change behaviour, reach in `tatva_connect` first, in
   order: `override_doctype_class` → `override_whitelisted_methods` → `doc_events`/
   `scheduler_events` → Custom Field/Property Setter fixtures → CRM Form Script → enable a
   native slot + override its backend. **Add a CRM-fork change ONLY when the framework
   exposes nothing** and the alternative is a DOM/title/order hack. When in doubt, STOP and
   surface it before editing the fork.
2. **Touched upstream files are additive + guarded + logged.** Every edit to an upstream
   file gets a `// TATVA:` marker and a row in **`CUSTOMIZATIONS.md`** (file · change ·
   reason), so divergence is one `grep` away. Each hook is guarded so the CRM is 100% stock
   when `tatva_connect` isn't loaded. New code prefers a **new additive component in
   `tatva/`** over editing upstream.
3. **Updates cherry-pick FROM upstream into `tatva` — never push to `frappe/crm`.** See
   `CUSTOMIZATIONS.md` for the update workflow.
4. **Code only in this repo clone — never in a bench app folder.** The bench is a disposable
   copy used to run/verify; sync via git (commit → push → pull), never by hand-editing it.

## Where things live

- **UI rules (non-negotiable):** **`UI.md`** in this repo — the UI constitution. Read it
  before any frontend change.
- **What we've touched upstream + why:** `CUSTOMIZATIONS.md`.
- **The master constitution** (architecture invariants, how-to-work, deploy): the
  `frappe_tatva_connect` repo's `CLAUDE.md`. This file does not repeat it.
- **Our components:** `frontend/src/tatva/` (generic, prop-driven, named generically).

## Branches & deploy

Solo flow, **no PRs** — `develop` (default) → `uat` → `prod`.
- **`develop`** = where you work; the dev bench tracks it.
- **Promote by fast-forward** when green: `git checkout uat && git merge --ff-only develop && git push`, then the same `uat → prod`. The branch name = the environment.
- **Deploy** bakes a branch into the image via per-env `apps.json` in `tatva_connect`: `apps.uat.json` (crm: `uat`) for UAT, `apps.prod.json` (crm: `prod`) for PROD. **Local uses none of these** — just `git checkout develop` on the bench.
- **CI (push-triggered, no cron):** `Frontend CI` (ESLint/Oxlint + Vitest unit & component) on every push to all three; `Backend CI` (heavy bench tests) only on `uat`/`prod`. `E2E` (Playwright) is manual-only (`workflow_dispatch`). Blocking is enforced by branch protection on `prod`.

## Testing (three layers, one framework)

Frontend tests live in `frontend/tests/` and `frontend/e2e/`. Run with `yarn`:
- **Unit** (`tests/unit/`, `yarn test:unit`) — pure logic (grain keys, predicates, field transforms). Vitest.
- **Component** (`tests/component/`, `yarn test:component`) — our `src/tatva/` components mounted with
  `@vue/test-utils`. Resolution uses **frappe-ui's own Vite plugin** (same as the app build) so real
  frappe-ui components mount with no shims; data-driven components are mocked at the network layer with
  **MSW** (frappe-ui's own convention). Shared mount brain: `tests/component/_mount.js` (C.26). Each spec
  pins ONE contract (props → render/emit), tests only our code, no network except via MSW.
- **E2E** (`e2e/`, `yarn e2e`) — Playwright against a LIVE bench (desktop + ~393px mobile). Local-first;
  auth is minted once via the Frappe API from `E2E_USER`/`E2E_PASSWORD` (never committed). Browser binary:
  `yarn e2e:install`. CI is manual-only (`E2E` workflow, `workflow_dispatch`) — never on push, never blocking.

`yarn test:run` runs unit + component. New component spec = read the component's real API first, then write
the contract; verify green locally before pushing. Adding a new tested module? add it to coverage `include`.

## Dev loop

Edit here → commit → push `develop` → on the devbench `git reset --hard origin/develop` →
`yarn build` (frontend) and/or `bench migrate` (if a `tatva_connect` change rode along).
Then PWA cache-bust before verifying (see `UI.md` §9). Verify at ~390px (see `UI.md` §19).
```
