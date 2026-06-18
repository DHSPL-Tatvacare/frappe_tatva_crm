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
| `frontend/src/components/Activities/Activities.vue` | +1 import, +1 `// TATVA:` branch that ALWAYS mounts `<TatvaTasks>` for a lead's Tasks tab (in-block Tasks branch reverted to native `TaskArea` for deals); PLUS a 2nd `// TATVA:` branch routing our synthetic audit entry types (`activity_logged`/`stage_moved`/`task_created`/`task_closed`/`lifecycle`) to `<ActivityAuditEntry>` and skipping them in `update_activities_details` (they carry server-built fields) | Board owns lead Tasks entirely; mounts even with zero tasks. The audit branch renders the clean per-lead Activity timeline (chained docs/location/status) the server assembler produces |
| `frontend/src/components/Activities/ActivityHeader.vue` | Tasks button → native split-dropdown (`// TATVA:`) + `taskActions` | New Task (primary) + Log Activity (`window.__tcLogActivity`, now owned by `<TatvaTasks>`) via frappe-ui `Button`+`Dropdown` |
| `frontend/src/pages/Tasks.vue` | `// TATVA:` import + `showTask` intercept + `<TatvaTaskModal>` mount | Global Tasks list/kanban: an activity task (type carries config) opens our config-driven modal via `activity.api.task_detail`; plain tasks keep the native doctype modal |
| `frontend/src/pages/Lead.vue` | `// TATVA:` import + header status `<Dropdown>` replaced by `<TatvaStagePill>` (writes `custom_stage` via `triggerOnChange`) | Lead lifecycle is grain-scoped (`custom_stage`), not the native global `status`; native `status`/SLA/Convert plumbing left intact, just no longer rendered in the header |
| `frontend/src/pages/MobileLead.vue` | `// TATVA:` import + mobile status `<Dropdown>` replaced by the same `<TatvaStagePill>` | Mobile parity for the grain-scoped lead stage pill (field reps are mobile-first); same component, same `custom_stage` write path |
| `frontend/src/App.vue` | `// TATVA:` +3 imports + `onMounted` (when `session.isLoggedIn`) calling `initTatvaPush()`, `startTatvaPresence($socket)`, `startTatvaNotify($socket)` | One touchpoint for the rep's notification surface: registers FCM push, starts the presence heartbeat, and attaches the in-app toast handler to the existing CRM socket. No-op until `CRM Push Settings` is filled; all logic lives in `tatva_connect` + `src/tatva/` |
| `frontend/src/components/Settings/Settings.vue` | `// TATVA:` +1 import (`NotificationsSettings`) + a guarded **Notifications** item under "User Configuration" | Native per-user notification prefs panel. Guarded (`...(NotificationsSettings ? [...] : [])`) so stock CRM is unaffected when the panel isn't bundled |
| `frontend/package.json` | added the `firebase` dependency | Browser FCM SDK used by `src/tatva/push.js` (token mint + foreground message) and the messaging service worker |

### WhatsApp native promotion (retires the 4 `tatva_connect` WhatsApp form-script DOM hacks)
All WhatsApp UI is now native + first-class. The `tatva_connect` backend is **unchanged** — components call the same whitelisted endpoints the old form scripts did. Send-Template is the **only** template flow (the native crm selector is unwired).
| File | Change | Reason |
|------|--------|--------|
| `frontend/src/composables/whatsapp.js` | `// TATVA:` `whatsappRouted` ref + `resolveWhatsappRoute(doctype, name)` (calls `tatva_connect.whatsapp.routing.lead_has_route`) | Lead-aware WhatsApp gate (replaces `whatsapp_gate.js`); fail-closed (no route ⇒ hidden) |
| `frontend/src/components/Activities/ActivityHeader.vue` | `// TATVA:` WhatsApp block → split button `[ Send Template ▾ ]` (primary) + `whatsappActions` dropdown (Send Message, Refresh History); New-dropdown WhatsApp item gated on `whatsappRouted`; emits `refresh-history` | Tab-only gating; one place to send a template / free-text / refresh, native frappe-ui split button (mirrors the Tasks tab) |
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` mounts `<TatvaWhatsAppTemplate>` (drops `WhatsappTemplateSelectorModal` + native `sendTemplate`); `failedReasons` resource passed to `<WhatsAppArea>`; `refreshHistory()` (`refresh_messages_from_wati` → reload) | Our grain-scoped template dialog is the only flow; failure-reason tooltips + Refresh History ride existing endpoints |
| `frontend/src/components/Activities/WhatsAppBox.vue` | `// TATVA:` `whatsapp_window_state` check → renders `<TatvaWhatsAppWindowNotice>` instead of the composer when the 24h window is closed; emits `send-template`; `show()` guarded | Native 24h window gate (replaces `whatsapp_window.js`); fail-open (unknown ⇒ composer stays) |
| `frontend/src/components/Activities/WhatsAppArea.vue` | `// TATVA:` failed `Badge` wrapped in `Tooltip` from `failedReasons[name]` prop | Native delivery-failure reason on hover (replaces `whatsapp_failed_reason.js`) |
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` Activity feed final return `.reverse()` → newest-first, top to bottom (Calls/Tasks/Notes unchanged) | Operators read the latest activity first instead of scrolling a chat-style oldest-first log |

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
- `frontend/src/tatva/TatvaStagePill.vue` — grain-scoped lead lifecycle pill for the lead header (Lead.vue +
  MobileLead.vue). Sources options from ONE server resolver (`tatva_connect.lead.leads.lead_stages`, scoped to the
  lead's program), strips the redundant program prefix from `display_label`, renders a flat clickable list, and
  emits the chosen leaf so the parent writes `custom_stage` (server `validate_stage` is the fail-closed backstop and
  derives `custom_main_stage`). Pure presentation + one resource call — no business logic in the fork.
- `frontend/src/tatva/ActivityAuditEntry.vue` — one clean per-lead **audit** row for the synthetic entries the
  server assembler (`tatva_connect.api.activities.get_activities`) injects: a logged activity with its status +
  location + documents folded inline, a legible stage move (`from → to`), or a plain task created/closed. Pure
  presentation; every field is decided server-side. Native rows (calls/emails/WhatsApp/comments/field changes)
  keep their own renderers — `Activities.vue` routes only our `activity_type`s here.
- `frontend/src/tatva/TatvaWhatsAppTemplate.vue` — the ONLY WhatsApp Send-Template dialog (the crm selector is
  unwired). Native `Dialog`/`Autocomplete`/`FormControl`: pick → preview → fill → send, riding ONLY `tatva_connect`
  (`get_send_context`/`get_template_variables`/`get_field_options`/`send_template_with_params`/`templates_sync.sync_from_wati`).
  Grain routing decides the account; preview is built from safe text segments (no `v-html`). No business logic here.
- `frontend/src/tatva/TatvaWhatsAppWindowNotice.vue` — native composer replacement when the WhatsApp 24h window is
  closed: the WhatsApp tab icon + expiry note + ONE **Send Template** button (emits `send-template`). Pure presentation;
  `WhatsAppBox` decides closed/open from `tatva_connect.api.whatsapp.whatsapp_window_state`.
- `frontend/src/tatva/push.js` — browser/PWA push registration (`initTatvaPush`, called once from `App.vue`).
  Fetches the public web config (`tatva_connect.notifications.api.get_web_config`), asks notification
  permission, registers the Firebase messaging service worker at its own push scope (no clash with the Workbox
  app SW), mints an FCM token, and POSTs it to `…api.register_token`. No business logic here — it only moves the
  token; all sending lives in `tatva_connect`. No-op until `CRM Push Settings` is filled.
- `frontend/public/firebase-messaging-sw.js` — Firebase Cloud Messaging service worker (served at
  `/assets/crm/frontend/firebase-messaging-sw.js`). Renders background push toasts and routes clicks. Carries no
  config (the page passes the public web config via a `?config=` query param) and no secrets.
- `frontend/src/tatva/presence.js` — client presence heartbeat (`startTatvaPresence`, called once from `App.vue`).
  `mark_present` every ~30s only while `$socket.connected && document.visibilityState === 'visible'`; a
  `navigator.sendBeacon` `mark_away` on pagehide / tab-hidden. `device_id` = the FCM token (so presence subtracts
  cleanly from the FCM subscription set server-side) or a stable per-browser id when push was declined. No logic —
  the server TTL is the real backstop; this only moves a beat. Rides `tatva_connect.notifications.presence`.
- `frontend/src/tatva/notify.js` — in-app toast surface (`startTatvaNotify`, called once from `App.vue`). Attaches
  an ADDITIONAL `$socket` handler for `tatva_notification` (Socket.IO allows many handlers; `Notifications.vue` is
  untouched) and pops a native frappe-ui `toast` (title/body, action → route). The server publishes the event to a
  PRESENT rep only, so a toast and an OS push never both fire for one event. Design tokens only, no business logic.
- `frontend/src/tatva/NotificationsSettings.vue` — native per-user notification prefs panel (mounted as the
  Settings → Notifications tab). Rows derive ENTIRELY from `tatva_connect.notifications.api.get_my_notification_prefs`
  (only globally-enabled grains; never a dead toggle) and save via `…save_my_notification_prefs`. A master "push on
  this device" switch drives `initTatvaPush()`/permission. `SettingsLayoutBase` + frappe-ui `Switch`, tokens only.

> **Phase 2 (DONE lifecycle + editable modal):** completion of an existing/automation task now runs from the
> board with EXACT identity (`save_activity(task=name)`), gated and audited server-side
> (`compute_activity`/`precheck` thread `task=` into `CRM Visit Audit`). The ad-hoc punch moved off the
> `tatva_connect` form script (`activity_log.js`, retired) into the native create modal. Server `validate`
> backstops (`enforce_location`/`enforce_activity_logged`) still fail-close every path.
