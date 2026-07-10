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

This repository is the frontend of TatvaCare's healthcare CRM: a lean fork of
[`frappe/crm`](https://github.com/frappe/crm) (a Vue 3, Vite, and frappe-ui single-page app), pinned at
`v1.73.2`. It is mobile-first, so the field works from a phone. It holds UI only; all business logic
lives in the backend.

## Two repos, one product

| Repo | Role |
|---|---|
| `frappe_tatva_crm` (this) | the UI: the single-page app teams use |
| [`frappe_tatva_connect`](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect) | the backend: doctypes, APIs, and all business logic |

Every rule (permissions, grain scoping, lead and messaging routing, automations, intake) lives in
`frappe_tatva_connect` and is enforced server-side and fail-closed. This repo is the interface that
consumes it. The two ship together on one site and move in lockstep. What we changed in the base app,
and why, is recorded in [`CUSTOMIZATIONS.md`](CUSTOMIZATIONS.md).

## Development

```bash
cd frontend
yarn install
yarn dev          # hot-reload dev server
yarn build        # production bundle, served at /crm
```

Verify every UI change at about 390px (mobile-first) before shipping.

## License and acknowledgements

Built on the [Frappe Framework](https://frappeframework.com) and
[Frappe CRM](https://github.com/frappe/crm). Licensed under GNU AGPL v3; see [LICENSE](LICENSE). Original
work is copyright Frappe Technologies Pvt. Ltd.; modifications are copyright TatvaCare.
