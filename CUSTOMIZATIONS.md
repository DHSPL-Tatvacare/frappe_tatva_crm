# TatvaCare fork of Frappe CRM

This is a **lean fork** of [`frappe/crm`](https://github.com/frappe/crm), forked at tag **`v1.73.2`**.

## Why a fork exists
The CRM SPA exposes no clean client hook for task/list interactions, and reliability for 300+
field-sales users cannot rest on DOM guessing. This fork adds **first-class native components +
additive extension points** for the TatvaCare activity/task engine. **All business logic lives in
the `tatva_connect` app** — this fork holds UI + thin hooks only, never logic.

## Branch & remote model
- `origin` → `devops-tatvacare/tatva_frappe_crm` (this repo). Default branch **`tatva`**.
- `upstream` → `frappe/crm`. We **pull/cherry-pick from upstream — never push to it**.
- `tatva` = upstream `v1.73.2` + our changes. Pinned, deliberate.

## Update workflow (cherry-pick, deliberate)
```bash
git fetch upstream
git log upstream/main --oneline        # pick the commits/features you want
git cherry-pick <sha>                  # small surface -> conflicts rare
# build, prove on dev, then push
git push origin tatva
```

## Build (we ship our own frontend bundle)
```bash
cd frontend && yarn install && yarn build
# then bake into the prod image as usual (apps.json -> this fork, branch `tatva`)
```

## Discipline — keep the fork lean and auditable
- **All our code lives in `frontend/src/tatva/`** (new files → never conflict on cherry-pick).
- **Edits to upstream files are minimal and marked `// TATVA:`** with a one-line reason.
- **Every touched upstream file is listed below.** If it's not in this table, we didn't change it.

## Touched upstream files
| File | Change | Reason |
|------|--------|--------|
| _(none yet)_ | | |
