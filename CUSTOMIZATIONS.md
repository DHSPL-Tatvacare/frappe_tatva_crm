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
| `frontend/src/components/Activities/Activities.vue` | +1 import, +1 `// TATVA:` branch that ALWAYS mounts `<TatvaTasks>` for a lead's Tasks tab (in-block Tasks branch reverted to native `TaskArea` for deals) | Board owns lead Tasks entirely; mounts even with zero tasks so the first activity can be logged |
| `frontend/src/components/Activities/ActivityHeader.vue` | Tasks button → native split-dropdown (`// TATVA:`) + `taskActions` | New Task (primary) + Log Activity (`window.__tcLogActivity`, now owned by `<TatvaTasks>`) via frappe-ui `Button`+`Dropdown` |
| `frontend/src/pages/Tasks.vue` | `// TATVA:` import + `showTask` intercept + `<TatvaTaskModal>` mount | Global Tasks list/kanban: an activity task (type carries config) opens our config-driven modal via `activity.api.task_detail`; plain tasks keep the native doctype modal |

## Drift guard
Run `bash scripts/check-tatva-hooks.sh` before every build — it exits non-zero if an upstream merge
dropped any `// TATVA:` seam above (so a silent regression can't ship). Green = all hooks intact.

## Our files (additive — never conflict)
- `frontend/src/tatva/TatvaTasks.vue` — native config-driven Tasks/Activities board (renders from
  `tatva_connect.activity.api.lead_task_board`); uniform cards, Badges, OSM thumbnail. Card status control
  routes Done through our complete flow with the exact `task.name` (no DOM/title guessing); owns the ad-hoc
  create flow (grain-scoped picker → create modal) and `window.__tcLogActivity`.
- `frontend/src/tatva/TatvaTaskModal.vue` — config-driven modal: view / complete / create off ONE config
  contract. Native controls (`FormControl`, `DateTimePicker`, `Link`) mirroring the CRM's own `Field.vue`,
  pre-filled, depends_on-aware. Runs the location lifecycle (`location_needed` → GPS → `precheck` gate →
  `save_activity`) and surfaces the out-of-range block + capture receipt via the server static_map proxy.
- `frontend/src/tatva/TatvaMiniMap.vue` — reliable OSM Leaflet thumbnail (canonical tiles, no key/Google cost).

> **Phase 2 (DONE lifecycle + editable modal):** completion of an existing/automation task now runs from the
> board with EXACT identity (`save_activity(task=name)`), gated and audited server-side
> (`compute_activity`/`precheck` thread `task=` into `CRM Visit Audit`). The ad-hoc punch moved off the
> `tatva_connect` form script (`activity_log.js`, retired) into the native create modal. Server `validate`
> backstops (`enforce_location`/`enforce_activity_logged`) still fail-close every path.
