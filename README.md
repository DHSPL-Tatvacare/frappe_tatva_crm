<div align="center">

<img src=".github/assets/tatva-logo.png" width="88" height="88" alt="TatvaCare" />

# TatvaCare CRM

**The customer & operations CRM for TatvaCare — part of the TatvaCare One platform.**

[![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![PWA](https://img.shields.io/badge/PWA-mobile--first-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

</div>

## Overview

TatvaCare CRM is part of **TatvaCare One** — the single platform our teams use across **sales and
operations** for one connected view of the business. It manages customers and leads, activities and
tasks, calls, WhatsApp, and scoped workflows for teams across TatvaCare's businesses, and is
**mobile-first** so the field works from a phone.

This repository is the **frontend** — the single-page app those teams use.

## Architecture — two repos, one product

| Repo | Role |
|---|---|
| **`frappe_tatva_crm`** (this) | the **UI** — the single-page app teams use |
| **[`frappe_tatva_connect`](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect)** | the **backend** — doctypes, APIs, and **all business logic** |

Every rule — permissions, program/grain scoping, lead & messaging routing, automations, intake —
lives in **`frappe_tatva_connect`** and is enforced **server-side, fail-closed**. This repo is the
interface that consumes it. The two ship together on one site and move in lockstep.

## Tech stack

- **Vue 3** · **Vite** · **Tailwind CSS** — the SPA (`frontend/`)
- **Python 3.10+** — the application backend (`crm/`)
- **PWA** (service worker) — installable, offline-aware, mobile-first

## Repository layout

```
frappe_tatva_crm/
├── crm/                      # application backend (Python)
├── frontend/
│   └── src/
│       ├── tatva/            # ★ our additive, generic, prop-driven components
│       └── components|pages/ # base SPA — edits are guarded + marked // TATVA:
├── CLAUDE.md                 # working rules + how this repo connects to tatva_connect
├── UI.md                     # ★ the UI constitution (non-negotiable)
├── CUSTOMIZATIONS.md         # every base-app file we touched · why · where
└── README.md
```

## Documentation

| Read | For |
|---|---|
| **[`UI.md`](UI.md)** | the UI constitution — **read before any frontend change** |
| **[`CLAUDE.md`](CLAUDE.md)** | working rules + how this repo connects to `tatva_connect` |
| **[`CUSTOMIZATIONS.md`](CUSTOMIZATIONS.md)** | what we changed in the base app and why |

## Development

```bash
cd frontend
yarn install
yarn dev          # hot-reload dev server
yarn build        # production bundle (served at /crm)
```

> Verify every UI change at **~390px** (mobile-first) before shipping — see [`UI.md`](UI.md) §19.

## License & acknowledgements

Built on the **[Frappe Framework](https://frappeframework.com)** and **[Frappe CRM](https://github.com/frappe/crm)** projects.
Licensed under **GNU AGPL v3** — see [LICENSE](LICENSE). Original work © Frappe Technologies Pvt. Ltd.; modifications © TatvaCare.
