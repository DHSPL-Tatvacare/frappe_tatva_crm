# TatvaCare fork of Frappe CRM

This is a **lean fork** of [`frappe/crm`](https://github.com/frappe/crm), forked at tag **`v1.73.2`**.

## Why a fork exists
The CRM SPA exposes no clean client hook for task/list interactions, and reliability for 300+
field-sales users cannot rest on DOM guessing. This fork adds **first-class native components +
additive extension points** for the TatvaCare activity/task engine. **All business logic lives in
the `tatva_connect` app** — this fork holds UI + thin hooks only, never logic.

## Branch and remote model
- `origin` is `DHSPL-Tatvacare/frappe_tatva_crm` (this repo). Branches: `develop` (work), `uat`, `prod`.
- `upstream` is `frappe/crm`. We pull and cherry-pick from upstream, and never push to it.
- The fork is upstream `v1.73.2` plus our changes. Pinned and deliberate.

## Update workflow (cherry-pick, deliberate)
```bash
git fetch upstream
git log upstream/main --oneline        # pick the commits or features you want
git cherry-pick <sha>                  # small surface, so conflicts are rare
# build, prove on the dev bench, then push to develop; fast-forward promote develop to uat to prod
git push origin develop
```

## Build (we ship our own frontend bundle)
```bash
cd frontend && yarn install && yarn build
# then bake into the image: apps.uat.json (crm: uat) / apps.prod.json (crm: prod) in tatva_connect
```

## Discipline — keep the fork lean and auditable
- **All our code lives in `frontend/src/tatva/`** (new files → never conflict on cherry-pick).
- **Edits to upstream files are minimal and marked `// TATVA:`** with a one-line reason.
- **Every touched upstream file is listed below.** If it's not in this table, we didn't change it.

## Touched upstream files
| File | Change | Reason |
|------|--------|--------|
| `frontend/src/components/Activities/Activities.vue` | +1 import, +1 `// TATVA:` branch that ALWAYS mounts `<TatvaTasks>` for a lead's Tasks tab (in-block Tasks branch reverted to native `TaskArea` for deals); PLUS a 2nd `// TATVA:` branch routing our synthetic audit entry types (`activity_logged`/`stage_moved`/`task_created`/`task_closed`/`lifecycle`) to `<ActivityAuditEntry>` and skipping them in `update_activities_details` (they carry server-built fields) | Board owns lead Tasks entirely; mounts even with zero tasks. The audit branch renders the clean per-lead Activity timeline (chained docs/location/status) the server assembler produces |
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` +1 import + 1 guarded branch on the `Data` tab: CRM Lead mounts `<TatvaDetailPanel>` (clean grain/brain-aware Lead Details), every other doctype keeps native `<DataFields>` | Replaces the raw child-table grids + the `data_tab_gate.js` DOM hack; panel is server-resolved by `tatva_connect.lead.detail.lead_detail` (grain-entitled + program-world applicable), edited via `update_lead_detail` (server-built write allowlist). New component: `frontend/src/tatva/DetailPanel.vue` |
| `frontend/src/components/Resizer.vue` | `// TATVA:` +1 `defineEmits(['update:sidebarWidth'])` + 1 `watch` that emits the width | The width was written to `localStorage` and read back by no caller, so every side panel reopened at its default. A caller that wants to remember one needs the value; the alternative was a second resizer beside it. Adopted by the workflow canvas's node inspector; the four native pages are unaffected |
| `frontend/src/components/ViewControls.vue` | `// TATVA:` the **Import** item removed from the overflow menu (and its now-dead `ImportIcon` import) | Loading records from a spreadsheet writes rows with no per-row automation, no grain clamp and no undo. It stays in Desk, where frappe's own two gates apply — `allow_import` on the DocType (`DataImport.validate_doctype` refuses on it BEFORE any permission check, and a System Manager does not bypass that line) and the `import` DocPerm. `tatva_connect.access.lockdown.IMPORT_OFF` turns that flag off for every listed doctype **except CRM Lead**, whose bulk load is the one the business runs and which the flag would have killed at Desk too. The item lived in ONE place, so deleting it clears every list page at once; `tests/architecture/noImportFromWorklists.test.js` stops it being re-added to a single page later. **Export is untouched — it reads.** |
| `frontend/src/components/ViewBreadcrumbs.vue` | `// TATVA:` +1 optional `items` prop (`[{label, route}]`) rendered as crumbs between the list root and the view dropdown | A list scoped to ONE record has to name that record and offer the way back to it — the workflow runs page is `Workflows / <name> / Runs`, and the stock component is a fixed two-crumb header. Additive and guarded: an empty `items` (every stock list page) renders byte for byte what it rendered before. The alternative was a second breadcrumb bar beside the view dropdown, i.e. the header built twice |
| `frontend/src/components/ListViews/ListRows.vue` | `// TATVA:` restored `h-full min-h-0 overflow-y-auto` on the ungrouped scroll container (line ~33) | Inherited frappe/crm bug: the ungrouped list didn't scroll on mobile/PWA (the grouped sibling already had the height chain) |
| `frontend/src/components/Activities/ActivityHeader.vue` | `// TATVA:` mounts the **native** `<Filter doctype="CRM Task" :fields>` left of New Task (Tasks tab) + `onTaskFilter` | Status/task-type filter for the lead Tasks board — the standard Filter.vue (guarded `fields` prop), wired client-side via the shared `tatva/taskFilter.js` + `filtersToPredicate` (no custom filter UI) |
| `frontend/src/components/Activities/ActivityHeader.vue` | Tasks button → native split-dropdown (`// TATVA:`) + `taskActions` | New Task (primary) + Log Activity (`window.__tcLogActivity`, now owned by `<TatvaTasks>`) via frappe-ui `Button`+`Dropdown` |
| `frontend/src/components/Activities/ActivityHeader.vue` | `// TATVA:` shared toolbar — a search `FormControl` + the native `Filter` (driven by the active tab's published `fields`) added to the header row for Comments/Notes/Calls/Tasks/Attachments; writes to `activityToolbar` | One search+filter mechanism across all activity tabs (the Tasks-only `Filter` was generalised, not removed) |
| `frontend/src/components/Activities/ActivityHeader.vue` | `// TATVA:` on `isMobileView` the tab search collapses to a ghost search icon; tapping expands it full-width over the row, tapping away (empty) restores. Desktop keeps the inline box unchanged | The `w-36` mobile box clipped the "Search Attachments…" placeholder; collapse-to-icon keeps the mobile row clean and the placeholder readable when open |
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` `displayActivities` applies the toolbar search+predicate to each filterable tab's already-loaded items (client-side, no extra API); a single per-tab `watch(title)` owns toolbar reset + publishes the static filter catalogs | Comments/Notes/Calls/Tasks/Attachments gain search+filter with no new state/fanout |
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` `scroll()` no-hash auto-scroll gated to WhatsApp only | The newest-first feeds (Activity/Emails/Comments) no longer jump down into history on load; deep-link (hash) scroll preserved |
| `frontend/src/components/Activities/AllModals.vue` | `// TATVA:` `showNote` opens `<TatvaNoteModal>` (mounted in this component) instead of the generic doctype modal; `onNoteSaved` keeps the same reload/onboarding/telemetry/redirect side-effects | Notes get a modal with native attachments; tasks/calls keep the generic modal |
| `frontend/src/components/Modals/DoctypeModal.vue` | `// TATVA:` +1 import, `<Dialog>` to `<ResponsiveDialog>` (same `#body` slot) | The generic create/edit modal (Add Call and every other doctype) was a centered Dialog on mobile. The tag swap makes it a bottom sheet on the PWA and leaves desktop byte-for-byte stock. One path: no per-doctype sheet variants |
| `frontend/src/components/Activities/CallArea.vue` | `// TATVA:` rewritten as a thin adapter over the shared `<ActivityCard>` (U9): tile icon reads direction/outcome, badge carries the call status, meta = caller · duration, a "Recording" chip when present. Recording playback lives in the detail modal the card opens (no inline audio, no `reactive` mutation) | Calls share ONE card language with Notes/Tasks/Attachments; the Calls tab drops its timeline rail for a plain card list |
| `frontend/src/pages/CallLogs.vue` | `// TATVA:` added `v-if` beside the existing `v-model` on `<CallLogDetailModal>` | The stock contract (`GlobalModals.vue:3`) is `v-if` **and** `v-model`: `v-if` gives a fresh component per open. Without it the modal retains the last call log and paints it for a frame |
| `frontend/src/components/Activities/AttachmentArea.vue` | `// TATVA:` tile icon is the spotlight-search `AttachmentIcon` (amber) for every non-image file — distinct from the Notes icon, consistent with global search; images keep the thumbnail | Notes vs attachments were confusable (both document glyphs); one clip icon fixes it and matches search |
| `frontend/src/components/Modals/LeadModal.vue` | `// TATVA:` +3 imports (`ResponsiveDialog`, `GrainSelect`, `useEntitledGrains`), `<Dialog>` to `<ResponsiveDialog>`, `<GrainSelect>` mounted under the layout, and a `layoutTabs` computed that strips the forced `custom_vertical`/`custom_group`/`custom_current_program` fields for anyone who is not a System Manager — then drops any section left with no fields; `<GrainSelect resolve-wildcard>` and a `grainRequired` that no longer exempts a locked grain | Grain is the user's entitlement, never a free pick: a single-grain user's grain is applied silently (backend `CRM Lead.before_validate` is the fail-closed clamp), a manager picks. The empty-section drop is needed because stock `Section.vue` renders a section on `!section.hidden` alone, so a fully-stripped section would show as a bare header. `resolve-wildcard` because this is the WRITE side — a rep entitled to a whole group holds no key until they pick the leaf, so `grainLocked` stops implying "settled" and the required-check must cover it. Was previously undeclared here |
| `frontend/src/components/ListViews/LeadsListView.vue` | `// TATVA:` +1 import; `getLabel` resolves a Link cell through `tatva/linkTitle` (the framework's `_link_titles` map) | A Link cell holds the target's PK, which for our grain masters is a composite `::` key. The row keeps the PK (the list filters, sorts and groups by it) and the map carries the title |
| `frontend/src/components/ListViews/TasksListView.vue` | `// TATVA:` +1 import; same `getLabel` change | Same, for `custom_task_type`. Replaces the deleted `parse_list_data` server overrides, which overwrote the PK in the row and so broke click-to-filter and merged same-named stages across programs |
| `frontend/src/components/UserDropdown.vue` | `// TATVA:` dropped `condition: () => !isMobileView.value` from the `settings` case | Settings was unreachable on the PWA. Mobile now has a settings surface (`tatva/SettingsSheet`) bound to the same `showSettings` ref, so the item no longer needs hiding. `login_to_fc` keeps its gate |
| `frontend/src/components/Layouts/MobileLayout.vue` | `// TATVA:` +1 import + `<SettingsSheet />` | The mobile counterpart of `AppSidebar`'s `<Settings>`. Mounted in the LAYOUT, not in `MobileSidebar`, whose subtree lives inside a headlessui Dialog and unmounts with the drawer. One `showSettings` state, two renderers, chosen by layout |
| `frontend/src/pages/Notes.vue` | Rewritten from a card grid to the native list view (mirrors `Tasks.vue`): `ViewControls` (search/filter/sort/columns) + `<NotesListView>`, rows/columns parsed via `parseRows`; create/edit open `<TatvaNoteModal>` (attachments) | Notes main page is now a full native list with the standard toolbar; row-click opens the unified note modal |
| `frontend/src/components/ListViews/NotesListView.vue` | New file (mirrors `TasksListView.vue`) | Native `ListView` for FCRM Note: owner avatar, timeAgo dates, Text-Editor content, bulk actions; row-click emits `showNote` |
| `frontend/src/pages/Tasks.vue` | `// TATVA:` import + `showTask` intercept + `<TatvaTaskModal>` mount | Global Tasks list/kanban: an activity task (type carries config) opens our config-driven modal via `activity.api.task_detail`; plain tasks keep the native doctype modal |
| `crm/fcrm/doctype/crm_lead/test_records.json` | `# TATVA:` emptied to `[]` (was 35 stock lead fixtures) | Our CRM Lead is hash-named, so frappe's test-record idempotency — which matches on `name` — can never find an existing row and recreates all 35 on every run. `dedup_guard` then correctly refuses them and the whole suite dies before a single test runs. The stock numbers were also `+1-555-01NN`, which `to_e164` rejects as invalid, so the records could never insert here at all; 287 half-created leads had accumulated on the dev site since July. Nothing in `tatva_connect` calls `get_test_records` (zero hits) and every one of our tests builds its own grain-carrying lead, so the records served nobody and blocked everyone. Emptied rather than deleted so the file stays visible in this table |
| `crm/fcrm/doctype/crm_task/crm_task.py` | `# TATVA:` `default_list_data().rows` extended to the full rep-facing set (`start_date`, `custom_outcome`, `custom_followup_at`, `custom_scheduled_at`) | It is the ONE declaration of what the task list may offer. `tatva_connect/api/task_lenses.py` narrows Filter/Group-By/Sort/Columns through it, so the nine shared slots and the operational columns (workflow token, LSQ ids, GPS, ASM) never reach a rep picker. A static list, not logic — no behaviour lives in the fork |
| `frontend/src/pages/Tasks.vue` | `// TATVA:` `group_by` added to `allowedViews`; `getGroupedByRows()` reshapes flat rows to `[{group,label,rows}]` (mirrors `Leads.vue`) and resolves each header's `groupLabel` via `tatva/linkTitle` `linkTitleFor` off the group field's Link target in `data.fields` | Group By works on the task list, and grouping by Task Type keys on the composite `::` PK (two grains may share a `type_name` and must not merge) while the HEADER reads the clean title from the existing `_link_titles` map. No `fetch_from` name column, nothing written back into the row |
| `frontend/src/components/ListViews/ListRows.vue` | `// TATVA:` group header renders `group.groupLabel ?? group.group` | The group stays KEYED on the raw value; a caller that resolved a human label supplies `groupLabel`. Backward compatible — Leads/Deals set nothing and are unchanged |
| `frontend/src/components/ViewControls.vue` | `// TATVA:` one cache-keyed `columnFields` `createResource` on `tatva_connect.api.task_lenses.get_column_fields`, passed as `:fieldSource` to both `<ColumnSettings>` mounts | The other three lenses are server endpoints we override; the column picker reads doctype meta in the browser, so this endpoint is its lens. Returns `[]` for any doctype that declares no rep-facing set ⇒ that picker stays 100% stock |
| `frontend/src/components/ListViews/TasksListView.vue` | `// TATVA:` `row` added to the `<ListRows v-slot>` destructure | The `_liked_by` cell already emitted `likeDoc({ name: row.name })` with `row` out of scope — an inherited crm bug that threw on click |
| `frontend/src/pages/Lead.vue` | `// TATVA:` import + header status `<Dropdown>` replaced by `<TatvaStagePill>` (writes the rep's pick `custom_substage` via `triggerOnChange`; reads derived parent `custom_stage` as `mainStage`) | Lead lifecycle is grain-scoped: the rep picks the leaf `custom_substage`, the server derives the parent `custom_stage` (and native global `status` from it); native `status`/SLA/Convert plumbing left intact, just no longer rendered in the header |
| `frontend/src/pages/MobileLead.vue` | `// TATVA:` import + mobile status `<Dropdown>` replaced by the same `<TatvaStagePill>` | Mobile parity for the grain-scoped lead stage pill (field reps are mobile-first); same component, same `custom_substage` write path / `custom_stage` derived-parent read |
| `frontend/src/App.vue` | `// TATVA:` +3 imports + `onMounted` (when `session.isLoggedIn`) calling `initTatvaPush()`, `startTatvaPresence($socket)`, `startTatvaNotify($socket)` | One touchpoint for the rep's notification surface: registers FCM push, starts the presence heartbeat, and attaches the in-app toast handler to the existing CRM socket. No-op until `CRM Push Settings` is filled; all logic lives in `tatva_connect` + `src/tatva/` |
| `frontend/src/components/Settings/Settings.vue` | `// TATVA:` +1 import (`NotificationsSettings`) + a guarded **Notifications** item under "User Configuration" | Native per-user notification prefs panel. Guarded (`...(NotificationsSettings ? [...] : [])`) so stock CRM is unaffected when the panel isn't bundled |
| `frontend/package.json` | added the `firebase` dependency | Browser FCM SDK used by `src/tatva/push.js` (token mint + foreground message) and the messaging service worker |
| `frontend/src/composables/useActiveTabManager.js` | `// TATVA:` `scrollActiveTabIntoView()` — re-scrolls the active tab into view on (re)mount and on tab change (guarded; no-op when already visible) | Selecting a tab changes the route hash → router-view (keyed on `fullPath`) remounts the page → the horizontal tab strip's `scrollLeft` reset to 0, throwing mobile users back to the first tab. Fix lives in the shared tab brain so it covers every tab/page (lead + deal, mobile + desktop) |
| `.github/workflows/frontend-tests.yml`, `.github/workflows/server-tests.yml` | `# TATVA:` removed the coverage-artifact upload + the "Coverage Wrap Up" job; DELETED `.github/actions/publish-codecov` and `.github/actions/upload-coverage` | Strip the only external data service in CI — `codecov/codecov-action` uploaded coverage to codecov.io (a third party). Tests still run + gate; no coverage data leaves CI (the `develop`-only gate meant it never ran on `tatva` anyway, but the integration is now gone entirely) |
| `crm/api/activities.py` (`get_attachments`) | `# TATVA:` +1 field (`custom_review_status`) in the File projection that feeds the Attachments tab | The document-review verdict (mirrored onto the File by `tatva_connect`) rides the SAME `get_activities` resource already loaded, so the Attachments-tab badge needs no extra call/fanout. Overriding `get_activities` would fork the whole lead+deal assembler (parallel brain); one field on the existing projection is the minimal path. Blank ⇒ never reviewed ⇒ no badge |
| `frontend/src/components/Activities/AttachmentArea.vue` | `// TATVA:` rewritten as a thin adapter over the shared `<ActivityCard>` (U9): maps each File → the card shape (thumbnail vs clip icon, source + privacy as icon-only bottom-right corner, review-verdict badge) and owns open/delete | One card language across Notes/Tasks/Attachments; rides `all_activities`, no new resource |
| `frontend/src/components/Activities/CommentArea.vue` | `// TATVA:` +1 backward-compatible `inRail` prop: in the Activity rail it hides its own header (the rail node/header supplies it) and borders the body white to match the `<ActivityCard>` bodies. Comments tab passes nothing → unchanged | The unified Activity rail renders comments coherently with the card items; the standalone Comments tab keeps its gray-block flavor |

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
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` Notes branch renders through the shared `<ActivityCard>` (U9) via a colocated `noteCard()` mapper + `deleteNote()`; card emits, we open (`modalRef.showNote`) / delete. Import swap `NoteArea`/`NoteCard` → `tatva/ActivityCard` + `tatva/activityCard.js` | Notes share ONE card language with Tasks/Attachments; dead `NoteArea.vue` **deleted** |
| `tatva_connect` `api/activities.py` (`lead_activity`, kind `task`) | `# TATVA:` the shared paged endpoint carries `due_iso`, the type label and `needs_capture` | The Tasks tab is a renderer over the SAME paged resource as every other tab — no second endpoint. The card compares an ISO date, never re-parses a display string |

### WhatsApp capability roles (policy lives in `tatva_connect`, fork only reads it)
WhatsApp is a capability decoupled from Sales (`WhatsApp User` / `WhatsApp Admin`). The allow-list and the doctype-permission matrix live ENTIRELY in `tatva_connect`; the fork keeps only two thin guarded hooks so a standalone crm still behaves exactly as shipped. No business logic added to the fork.
| File | Change | Reason |
|------|--------|--------|
| `crm/api/whatsapp.py` (`validate_access`) | `// TATVA:` reads `frappe.get_hooks("whatsapp_capability_roles")`, falling back to the stock `ALLOWED_WHATSAPP_ROLES` | One brain: the capability allow-list is published by `tatva_connect.whatsapp.roles`; stock list is the standalone fallback |
| `crm/api/whatsapp.py` (`add_roles`) | `// TATVA:` returns early when `tatva_connect` is installed | `tatva_connect.access.lockdown` owns the WhatsApp doctype perm matrix; prevents the fork re-adding the Sales grant we deliberately removed |
| `frontend/src/composables/whatsapp.js` | `// TATVA:` `whatsappHasRole` ref, resolved once from `tatva_connect.api.whatsapp.whatsapp_access` (mirrors `whatsappEnabled`) | Per-user capability signal for the tab gate; fail-closed (stays false until server confirms) |
| `frontend/src/pages/Lead.vue`, `pages/MobileLead.vue`, `components/Activities/ActivityHeader.vue` | `// TATVA:` WhatsApp tab/New-item condition now `enabled && routed && whatsappHasRole` | No WhatsApp role ⇒ no tab even on a routed lead (the per-user half of the three composing gates) |

### Near Me native page (retires the Near Me form-script hack)
A first-class native full-screen page reached from a gated LEFT-SIDEBAR link (desktop + mobile). The `tatva_connect` backend is **unchanged** — the page calls the same whitelisted endpoints (`near_me.api.near_me_access` / `near_me.api.doctors_in_territory`, `location.api.map_config` / `location.api.reverse_geocode`). Desktop "call" reuses the CRM's own telephony (`globalStore.makeCall`); mobile/PWA uses the system dialer.
| File | Change | Reason |
|------|--------|--------|
| `frontend/src/composables/nearMe.js` | **DELETED** — folded into `composables/surfaces.js` (see "Surface visibility, unified") | Its gate call was one of the three the boot key replaced |
| `frontend/src/components/Layouts/AppSidebar.vue` | `// TATVA:` +1 icon import (`LucideMapPin`) + ONE gated link `{ label:'Near Me', to:'NearMe', condition: () => surfaces.near_me }` in `links` | Desktop sidebar entry; `condition()` already honoured by the existing `links.filter`, so stock CRM is unaffected when access is off |
| `frontend/src/components/Mobile/MobileSidebar.vue` | `// TATVA:` +1 icon import + the same gated link + `links.filter(link.condition)` in `allViews` (mobile previously mapped `links` unfiltered) | Mobile parity for the gated Near Me link (left panel, not a bottom-nav tab) |
| `frontend/src/router.js` | `// TATVA:` top-level route `{ path:'/near-me', name:'NearMe', component: () => import('@/pages/NearMe.vue') }` before the catch-all, guarded by `surfaceGuard('near_me')` | Routes the page; `beforeEach` special-cases only the list pages, so `/near-me` falls through to `next()` |
| `frontend/package.json` | added the `leaflet.markercluster` dependency | Marker clustering on the Near Me territory map (`src/tatva/TatvaTerritoryMap.vue`) |

### Smart Views read-only surface (P1)
A first-class native page reached from a gated LEFT-SIDEBAR link (desktop AND mobile), fed by `tatva_connect.smartview.api` (`get_smart_views` / `get_data` / `access`). **Responsive view switcher:** DESKTOP = a fixed-176px-wide **windowed tab strip** (capacity = `floor(stripWidth / tabWidth)`, so nothing reflows when a count loads; tabs beyond the window live in a trailing `⋯` scrollable full-index popover that slides the window to the picked view). MOBILE/PWA = a **bottom sheet** picker (`TatvaBottomSheet`) instead of a strip. One native **bounded** `ListView` body (`ListHeader`/`ListRows` padded `mx-3 sm:mx-5`, typed column widths from each field's real fieldtype, `formatDate` cells). Read-only — a Lead-view row opens the Lead page; an Activity-view row opens the native activity/task modal (same `showTask` path as the global Tasks list). Authoring (drawer + stepper) is P2. CRM behaves 100% stock when the backend is absent (gate fail-closed ⇒ no link). Counts are lazy-on-click (§6): a tab shows no badge until its list loads, then it's cached.
| File | Change | Reason |
|------|--------|--------|
| `frontend/src/composables/smartViews.js` | NEW (`// TATVA:` `smartViewsVisible` ref + `resolveSmartViewsAccess()`, auto-resolved once on load) | Smart Views access gate, clone of `nearMe.js`; fail-closed (no access ⇒ link hidden) |
| `frontend/src/stores/smartViews.js` | NEW (`// TATVA:` Pinia setup-store `tatva-smart-views` wrapping `createResource('…get_smart_views')` + the lazy per-tab count cache) | Clone of `stores/views.js`; holds the tabs + each view's `total` (set by `SmartViewList` on load) |
| `frontend/src/tatva/smartViewFormat.js` | NEW (`// TATVA:` `formatCount` — compact `13.2k`/`1m`) | Shared count formatter so the fixed-width tab/sheet bubble stays small |
| `frontend/src/tatva/TatvaBottomSheet.vue` | NEW (`// TATVA:` `Teleport` + Vue `<Transition>` slide-up, safe-area aware) | Our mobile bottom-sheet primitive, in the SAME custom style as the Near Me sheet (`rounded-t-2xl border-t border-outline-gray-2 bg-surface-white shadow-2xl`, no framework Dialog) |
| `frontend/src/tatva/SmartViewTabs.vue` | NEW | DESKTOP fixed-width windowed strip + `⋯` overflow popover; capacity from `useElementSize`; lazy count bubble read direct from store |
| `frontend/src/tatva/SmartViewSheet.vue` | NEW | MOBILE view picker: a current-view button → `TatvaBottomSheet` list (active ✓ + lazy counts); same selection contract as the strip |
| `frontend/src/tatva/SmartViewList.vue` | NEW | Modelled on `ListViews/TasksListView.vue`: native bounded `ListHeader`/`ListRows`/`ListFooter` (`mx-3 sm:mx-5`), typed widths, `formatDate` cells; emits `openLead`/`openTask` |
| `frontend/src/pages/SmartViews.vue` | NEW | `LayoutHeader` + `ViewBreadcrumbs`; renders `SmartViewSheet` (mobile) or `SmartViewTabs` (desktop) over `SmartViewList`; mounts the config-driven `TatvaTaskModal` and routes row clicks; active view in `/smart-views/:view` |
| `frontend/src/components/Layouts/AppSidebar.vue` | `// TATVA:` +2 imports (`LucideLayoutGrid`, `smartViewsVisible`) + ONE gated link in `links` | Desktop sidebar entry; `condition()` honoured by the existing `links.filter` |
| `frontend/src/components/Mobile/MobileSidebar.vue` | `// TATVA:` +2 imports (`LucideLayoutGrid`, `smartViewsVisible`) + ONE gated `Smart Views` link in `links` | MOBILE sidebar entry, so the PWA reaches the surface; `condition()` honoured by the existing `allViews` filter |
| `frontend/src/router.js` | `// TATVA:` top-level route `{ path:'/smart-views/:view?', name:'SmartViews', component: () => import('@/pages/SmartViews.vue') }` next to the Near Me entry | Routes the page; `beforeEach` special-cases only the list pages, so it falls through to `next()` |
| `frontend/src/components/Filter.vue` | `// TATVA:` optional `fields` prop + `fieldData` computed; when a non-empty list is passed it replaces the `get_filterable_fields` doctype fetch (guarded: absent => stock) | Lets the SAME native filter UI drive the Smart Views catalog (incl. composite child `field_key`s) — the framework exposes no field-injection point, so this thin additive prop is the only non-DOM way to reuse it |
| `frontend/src/components/ColumnSettings.vue` | `// TATVA:` optional `fieldSource` prop; when non-empty it replaces `getMeta(doctype).getFields()` as the available-column source (guarded: absent => stock) | Same reason — reuse the native column picker over our catalog instead of a parallel implementation |
| `frontend/src/components/SortBy.vue` | `// TATVA:` optional `fields` prop + `sortFields` computed; when non-empty it replaces the `crm.api.doc.sort_options` doctype fetch (guarded: absent => stock) | Reuse the native sort control over our catalog's sortable fields (P2 list toolbar) |
| `frontend/src/tatva/useGrainFilterOptions.js` | NEW (`// TATVA:` one shared, cache-keyed resource over `tatva_connect.lead.filters.grain_filter_options`, plus `isGrainFilterField`) | The lead LIST is scoped by native User Permission, but its value dropdowns were not: frappe's Link search is called with the target doctype and **no `reference_doctype`**, so our narrow CRM-Lead-scoped permission never fires and the picker offered the whole master — a scoped rep could read every other business line's names. Sourcing the values from the caller's own `get_list` is self-scoping, needs no new permission, and unlike a permission-based filter it still works for a **wildcard** entitlement (which holds no programme permission at all). One singleton resource, mirroring `useEntitledGrains`, so the four consumers below share one fetch instead of fanning out. **Which fields count as grain axes is decided on the SERVER off the field meta** (a Link whose target is a grain master) and this file keeps no list of fieldnames — it asks whether the endpoint answered for the field. A first build hardcoded three names here and the two history Links (`custom_previous_program`, `custom_origin_vertical`) leaked the whole programme master because they were not on it |
| `frontend/src/pages/Dashboard.vue` | `// TATVA:` +2 imports, +1 composable call; the funnel's Product Line / Program `<Link doctype="CRM Vertical\|CRM Program">` filters replaced by native `FormControl type="select"` fed by the shared scoped values, each hidden when it offers ≤1 value | Same leak, same rule: those Links searched the master with no field context, and the filters are shown to a **manager** too — so a group-scoped manager saw every vertical on the site, including ones belonging to other business lines. Now they see their own values, and an axis with one value is hidden because it is not a choice. The charts themselves were already scoped (`visibility.scope`) — this was name-disclosure only |
| `frontend/src/components/QuickFilterField.vue` | `// TATVA:` +1 import, +1 `doctype` prop, and a grain branch **before** the `Link` branch rendering a native `FormControl type="select"` from the shared scoped values | The quick-filter strip's Link control is the leaking picker. Native `Controls/Link.vue` is deliberately NOT touched — the fix is to stop pointing a grain axis at it |
| `frontend/src/components/Filter.vue` | `// TATVA:` +1 import, +1 composable call, and a grain branch in `getValueControl` **before** `typeLink`, rendering a native `FormControl type="select"` | Same rule for the ad-hoc Filters-button value picker, so the two filter surfaces cannot disagree |
| `frontend/src/components/ViewControls.vue` | `// TATVA:` +1 import, +1 composable call, `:doctype` passed to `<QuickFilterField>`, and `quickFilterList` filtering out a grain axis with ≤1 value | A single-grain rep's "Product Line" quick filter offers one value that every visible lead already has — not a choice. Hiding it leaves the axis that actually discriminates; the count comes from the same shared source the pickers read |
| `frontend/src/tatva/GrainSelect.vue` | NEW (`// TATVA:` the ONE grain control; single grain → locked confirmation, manager → picker) + a `resolve-wildcard` prop, **default off**, adding a required child picker fed by `tatva_connect.access.entitlement.my_grain_pick_options` | An entitlement is a REGION and a lead is a POINT: on the WRITE side a region that wildcards an axis must resolve to one leaf, and the choice merges back into the same `vertical::group::program` key so the v-model contract is unchanged. Opt-in and off by default because this control is shared with `SmartViewEditor.vue` — the READ side, where a view scoped to a whole group is legitimate and a wildcard must stay a wildcard. With the prop off every expression is the pre-existing one and no options are fetched. The endpoint returns `{}` while `Access::Grain::registry` is dormant, so the flag alone decides |
| `frontend/src/tatva/SmartViewEditor.vue` | NEW | Authoring modal (create/edit/delete) — wider `Dialog` 3-step build journey using the INLINE generic `ConditionBuilder` + `ColumnManager` (popover controls spill outside a modal, so they're not embedded here); saves via `upsert_view`, deletes via `delete_view` behind the native confirm dialog |
| `frontend/src/tatva/ConditionBuilder.vue` | NEW (generic) | Inline AND-condition editor over any `{fieldname,label,fieldtype,options}` field list; v-model = composer predicate tree. frappe-ui controls, no popover. Reusable. |
| `frontend/src/tatva/ColumnManager.vue` | NEW (generic) | Two-panel "Manage Columns" — search + checkbox list of available fields, drag-reorder selected (vuedraggable). v-model = ordered key list. Reusable. (Pinning omitted: frappe-ui `ListView` can't freeze columns; model stays a plain ordered list so pin can layer on later.) |
| `frontend/src/tatva/smartViewPredicate.js` | NEW | Pure mapping between the native Filter.vue emit dict (list toolbar) and the composer predicate tree / ad-hoc filter array (no logic, no DOM) |
| `frontend/src/tatva/SmartViewTabs.vue` | `// TATVA:` (P1 NEW) + P2: per-view edit affordance in the ⋮ menu (shown when `can_write`), emits `edit` | Lets owners edit/delete their views from the strip; server re-checks ownership |
| `frontend/src/tatva/SmartViewSheet.vue` | `// TATVA:` (P1 NEW) + P2: per-view edit affordance, emits `edit` | Mobile equivalent of the strip's edit affordance |
| `frontend/src/tatva/SmartViewList.vue` | `// TATVA:` (P1 NEW) + P2: list toolbar mounts native `Filter`/`SortBy`/`ColumnSettings` fed the catalog; folds their output into `get_data`'s `filters`/`sort`/`columns` params (1× fetch per change) | Interactive filter/sort/columns with zero parallel engine |
| `frontend/src/pages/SmartViews.vue` | `// TATVA:` (P1 NEW) + P2: mounts `SmartViewEditor`, wires `@create`/`@edit`/`saved`/`deleted` | Hosts the authoring flow; refreshes tabs + lands on the saved view |

### Smart Views grain entitlement (P3)
The tab is now a **universal surface** — the sidebar link shows for every logged-in user; grain entitlement is enforced server-side, per view (a user only ever sees views/fields their grain allows). The editor's step 1 gains a **grain selector** fed by `tatva_connect.access.entitlement.my_entitled_grains` (auto-selected + read-only for a single-grain user; optional for a System Manager; required for a multi-grain user). The chosen grain is threaded into `field_catalog` and persisted on the view, so steps 2/3 re-resolve their field list on grain change.
| File | Change | Reason |
|------|--------|--------|
| `frontend/src/composables/smartViews.js` | REMOVED (was the `access()`-based sidebar gate) | The Smart Views link is now always visible; entitlement moved server-side, so the gate composable is dead code |
| `frontend/src/components/Layouts/AppSidebar.vue` | `// TATVA:` link condition dropped (always-visible); `smartViewsVisible` import removed | Universal surface — no client gate |
| `frontend/src/components/Mobile/MobileSidebar.vue` | `// TATVA:` link condition dropped (always-visible); `smartViewsVisible` import removed | Universal surface — no client gate (PWA) |
| `frontend/src/pages/SmartViews.vue` | `// TATVA:` empty branch is the native `EmptyState` alone (`width="lg"`), text-only; the create affordance is the native `LayoutHeader` `#right-header` Button | Matches Deals/Tasks/Notes exactly. The previous centered Button was a second absolutely-positioned layer over EmptyState's own absolute block, and collided with the wrapped title at 390px |
| `frontend/src/tatva/SmartViewEditor.vue` | `// TATVA:` step-1 grain selector (native `FormControl` select fed by `my_entitled_grains`); grain threaded into `field_catalog` params + persisted in the `upsert_view` payload + seeded from `get_view` on edit; `onGrainChange` re-resolves steps 2/3 | Grain-scoped authoring; reuses the native control + the one entitlement brain (no parallel resolution) |

### Main list/Kanban toolbar → grain-scoped field catalog
The shared worklist toolbar (`ViewControls.vue`) now drives Filter/Sort/Columns/Kanban-settings off the grain-scoped Smart Views field catalog (`tatva_connect.smartview.api.field_catalog`) for the **Lead** (`CRM Lead`) and **Activity** (`CRM Task`) worklists. base_object maps `CRM Lead`→`Lead`, `CRM Task`→`Activity`; any other doctype is NOT fetched, so every control stays on native doctype meta (100% stock). One cache-keyed `createResource`, fetched once on mount; the per-control lists are computed off `resource.data` (no copy-into-refs, no double-fetch — C3/C4). Reuses the existing guarded props on Filter/SortBy/ColumnSettings; adds the matching guard to KanbanSettings. No business logic in the fork — the catalog (grain + role entitlement) lives entirely in `tatva_connect`.
| File | Change | Reason |
|------|--------|--------|
| `frontend/src/components/ViewControls.vue` | `// TATVA:` `fieldCatalogBaseObject` computed + cache-keyed `fieldCatalog` `createResource` (fetched once on mount, only for Lead/Activity) + `catalogFilterFields`/`catalogSortFields`/`catalogColumnFields`/`catalogKanbanFields` computeds off `resource.data`; both render blocks pass `:fields`/`:fieldSource` to Filter/SortBy/ColumnSettings/KanbanSettings | Wires the native worklist toolbar to the grain-scoped catalog via the existing guarded props; non-Lead/Activity doctypes pass empty lists ⇒ controls stay stock |
| `frontend/src/components/Kanban/KanbanSettings.vue` | `// TATVA:` optional `fieldSource` prop; when non-empty it replaces `getMeta(doctype).getFields()` as the field source (column-field options derive its Link/Select subset, title/card options the full list); getMeta skipped when present (guarded: absent ⇒ 100% stock) | Reuse the native Kanban settings over our catalog instead of a parallel implementation — mirrors the `ColumnSettings.fieldSource` guard |

## Drift guard
Run `bash scripts/check-tatva-hooks.sh` before every build — it exits non-zero if an upstream merge
dropped any `// TATVA:` seam above (so a silent regression can't ship). Green = all hooks intact.

## Our files (additive — never conflict)
- `frontend/src/tatva/TaskModal.vue` — the ONE native task modal (create / edit / view / complete). Native
  controls (FormControl, TextEditorControl, DateTimePicker, DatePicker, Link, AttachControl): standard CRM
  Task fields + a Task Type dropdown that renders the type's schema (`get_schema`, depends_on-aware) +
  scoped lead `Link` (only when no lead/deal context). Save (button only) branches: typed → activity flow
  (resolve location only when the type needs it → `compute_activity_fields` + native insert on create,
  `save_activity` on complete); plain → native insert/set_value. enforce_* server backstops still fire.
  Contained body, internal scroll (no DOM hack). Wired into AllModals (lead/deal header) — board + listing
  page pending. Replaces TatvaTaskModal + task_activity.js (retire after all surfaces wired).
- `frontend/src/tatva/NoteModal.vue` — the ONE note create/edit modal (lead/deal Notes tab + Notes main
  page). 100% native controls: `FormControl` title, `TextEditorControl` (fixedMenu = the full formatting
  toolbar, identical to the native doctype form), and the native permission-scoped `Link` (CRM Lead) for
  linking a lead — shown ONLY when opened standalone (in a lead/deal context the link is implied + hidden).
  NOTHING hits the backend until Save: attachments are STAGED in memory (file name only) and uploaded on
  Save via the native upload handler (File `doc_events` own Azure privacy/offload); removals are staged and
  applied on Save. Reads existing attachments via `tatva_connect.api.notes.note_attachments`. Contained body
  with internal scroll (max-h + overflow) — no DOM height hack.
- `frontend/src/tatva/activityToolbar.js` — shared reactive ({search, fields, model, predicate}) for the
  activity-tab toolbar; generalises the old `taskFilter.js` (now removed) so Comments/Notes/Calls/Tasks/
  Attachments share ONE search+filter state. Active tab publishes `fields`; reads `search`+`predicate`.
- `frontend/src/tatva/activityMatch.js` — one client-side predicate matcher (`passesFilter`/`matchCondition`)
  mirroring the Filter.vue→`filtersToPredicate` operators; reused by `<TatvaTasks>` and `Activities.vue`.
- `frontend/src/tatva/TatvaTasks.vue` — native config-driven Tasks/Activities board (renders from
  `tatva_connect.api.activities.lead_activity` with kind `task`). Each task renders in the **unified activity-card shape**
  (timeline rail + "{rep} logged a task · {when}" header + a bordered content block of status/details),
  matching Calls/Comments. Card status control routes Done through our complete flow with the exact
  `task.name` (no DOM/title guessing); owns the ad-hoc create flow (grain-scoped picker → create modal)
  and `window.__tcLogActivity`.
- `frontend/src/tatva/ActivityCard.vue` — THE one card shape for Notes/Tasks/Attachments (U9). Dumb and
  presentational: no resource/store/fetch/router, it renders a normalized shape (`tile · title · badge ·
  meta · chips · actor · at · menu`) and emits `open` / `action(key)`; the parent area owns everything
  (U11). Anti-clutter (U10): routine facts → `meta`, exceptional state → one badge + ≤3 chips. One
  skeleton, `sm:` only grows the tile (U12). `#tile` is the single escape slot (thumbnail / status control).
- `frontend/src/tatva/activityCard.js` — the adapters' one helper: `oneLine()` collapses a rich body to a
  clean single line for `meta` (reuses `htmlToText`).
- `frontend/src/tatva/TatvaTaskModal.vue` — config-driven modal: view / complete / create off ONE config
  contract. Native controls (`FormControl`, `DateTimePicker`, `Link`) mirroring the CRM's own `Field.vue`,
  pre-filled, depends_on-aware. Runs the location lifecycle (`location_needed` → GPS → `precheck` gate →
  `save_activity`) and surfaces the out-of-range block + capture receipt via the server static_map proxy.
- `frontend/src/tatva/TatvaMiniMap.vue` — reliable OSM Leaflet thumbnail (canonical tiles, no key/Google cost).
- `frontend/src/composables/useSheetDrag.js` — the ONE draggable-bottom-sheet engine: pointer drag + snap
  points + **body scroll lock** (page behind never scrolls) + narrow-viewport detection. Shared by `pages/NearMe.vue`
  (resize panel) and the Smart Views mobile picker (`tatva/TatvaBottomSheet.vue` → `SmartViewSheet.vue`), so neither
  hardcodes its own drag. NearMe's `TatvaTerritoryMap.vue` "you are here" is a Google-Maps-style blue dot + pulsing halo (divIcon + CSS).
- `frontend/src/tatva/TatvaStagePill.vue` — grain-scoped lead lifecycle pill for the lead header (Lead.vue +
  MobileLead.vue). Sources options from ONE server resolver (`tatva_connect.lead.leads.lead_stages`, scoped to the
  lead's program), strips the redundant program prefix from `display_label`, renders a flat clickable list, and
  emits the chosen leaf so the parent writes `custom_substage` (the rep's pick; server `validate_stage` is the
  fail-closed backstop and derives the parent `custom_stage`). `mainStage` shows the derived parent read-only.
  Pure presentation + one resource call — no business logic in the fork.
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
- `frontend/src/pages/NearMe.vue` — the native Near Me page (sidebar-reached, full-screen, PWA). The map fills the view;
  the doctor list is a fixed 360px side panel on desktop and a DRAGGABLE bottom sheet on mobile (peek↔expanded, snaps on
  release, via pointer events). A recenter crosshair re-centres on the rep. ONE search + one filter Popover (stage/source/
  grain) + a compact radius Select (5/10/15/25/50, re-queries). On mount: device GPS → `location.api.reverse_geocode`
  (address line) + `near_me.api.doctors_in_territory(lat,lng,radius)` (list/markers). Call: desktop reuses `globalStore.makeCall`
  (telephony/dialer chooser) when `callEnabled`, else `tel:`; mobile/PWA always `tel:`. Directions open via an anchor-click
  (OS hands the URL to the Maps app — no orphan blank tab in a standalone PWA). Pure presentation; denial → permission/Retry.
- `frontend/src/tatva/TatvaDoctorCard.vue` — one doctor row: round Avatar (image/auto-colour), name, `stage · source · distance`
  meta, truncated address, grain Badge, and call/directions icon Buttons (disabled when no number / no coords). Emits
  `call`/`directions`/`select`; no logic (distance/labels are server-built).
- `frontend/src/tatva/TatvaTerritoryMap.vue` — interactive Near Me map, PROVIDER-TOGGLED per `location.api.map_config().nearme`:
  `osm` → Leaflet + OSM tiles + `leaflet.markercluster`; `google` → the Google Maps JS API (loaded with the referrer-restricted
  `map_config().browser_key`) + `@googlemaps/markerclusterer` (CDN). "You" marker + radius circle + clustered doctor markers;
  graceful fallback to OSM if Google can't load. Props `here`/`doctors`/`radiusKm`/`focus`; exposes `recenter()`; cleanup on unmount.
- `frontend/src/composables/surfaces.js` — the ONE surface gate (`surfaces` + `surfacesReady`), read
  SYNCHRONOUSLY off `window.surfaces`, the boot key `crm/www/crm.py` fills from
  `tatva_connect.access.surfaces.my_surfaces`. Replaced `composables/nearMe.js` and
  `composables/workflows.js` (both DELETED) and the third gate call Deals would have needed; fail-closed
  (missing payload or missing key ⇒ false). `surfacesReady` keeps `nearMeReady`'s awaitable contract for the
  route guards, already resolved because the answer arrived with the page. Never add a `call()` here.
- `frontend/src/tatva/NotificationsSettings.vue` — native per-user notification prefs panel (mounted as the
  Settings → Notifications tab). Rows derive ENTIRELY from `tatva_connect.notifications.api.get_my_notification_prefs`
  (only globally-enabled grains; never a dead toggle) and save via `…save_my_notification_prefs`. A master "push on
  this device" switch drives `initTatvaPush()`/permission. `SettingsLayoutBase` + frappe-ui `Switch`, tokens only.

> **Phase 2 (DONE lifecycle + editable modal):** completion of an existing/automation task now runs from the
> board with EXACT identity (`save_activity(task=name)`), gated and audited server-side
> (`compute_activity`/`precheck` thread `task=` into `CRM Visit Audit`). The ad-hoc punch moved off the
> `tatva_connect` form script (`activity_log.js`, retired) into the native create modal. Server `validate`
> backstops (`enforce_location`/`enforce_activity_logged`) still fail-close every path.

### Ops dashboard — grain-scoped lead funnel (P1)
The CRM SPA "Manager Dashboard" reshaped for the ops motion: **LEADS on top** (a program-scoped
stage/sub-stage funnel + Product-Line breakdown), a full-width trend divider, **DEALS at the end**.
Generic global-SaaS cards dropped (territory, forecast, blended avg deal value, deal-close time). The
chart **logic lives in `tatva_connect.dashboard.grain_charts`** — the fork holds only the `get_leads_by_*`
dispatch shims and the default layout. A native Vertical + Program `<Link>` pair drives the funnel
(GRAIN_AWARE charts only; stock charts stay unfiltered). Labels come from `CRM Lead Stage.display_label`
(never the `::` composite key), ordered by `position`. Existing sites pick up the new default via
`tatva_connect.patches.refresh_manager_dashboard_layout` (non-clobbering: only an untouched stock board).
| File | Change | Reason |
|------|--------|--------|
| `crm/api/dashboard.py` | `# TATVA:` `GRAIN_AWARE_CHARTS` + `get_leads_by_*` grain shims (→ `tatva_connect.dashboard.grain_charts`) and task/owner shims `get_total_tasks`/`get_pending_tasks`/`get_overdue_tasks`/`get_tasks_due_today`/`get_completed_tasks`/`get_leads_by_owner`/`get_tasks_by_owner` (→ `tatva_connect.dashboard.team_charts`); `get_dashboard`/`get_chart` gain `vertical`/`program` and pass them to grain-aware charts only | The framework dispatches `get_<name>` from this module only, so the shims must live here; logic stays in the app |
| `crm/fcrm/doctype/crm_dashboard/crm_dashboard.py` | `# TATVA:` rewrote `default_manager_dashboard_layout()` (leads-first order, new lead charts, cuts) + `import json` | The default is the shipped layout; used by fresh install + Reset to Default |
| `frontend/src/pages/Dashboard.vue` | `// TATVA:` native Vertical + Program `<Link>` filters (gated `isAdmin()||isManager()`), added to `filters` + `makeParams` | The grain control for the funnel; mirrors the existing user filter, works for admins (GrainSelect hides for them) |
| `frontend/src/components/Dashboard/AddChartModal.vue` | `// TATVA:` registered Leads by Stage / Sub-stage / Product Line; forwards `vertical`/`program` to `get_chart` | Makes the new charts addable in edit mode with the grain context |
| `frontend/src/components/Mobile/MobileSidebar.vue` | `// TATVA:` +1 icon import + a Dashboard entry (first) in the mobile `links` array | Upstream lists Dashboard in the desktop sidebar only; this adds mobile/PWA parity via the same native `SidebarLink`/`allViews` flow (no new state) |

### Lead Data tab — a section's `View more` opens its child table (2026-08-02)

| File | Change | Reason |
|------|--------|--------|
| `frontend/src/tatva/SectionRowsModal.vue` | NEW | A lead section IS a child table, so its detail is that table. Built as a standard listing surface and nothing else: the `ViewControls` toolbar (search + native `Filter` + `SortBy` + `ColumnSettings`, each fed a server-supplied field list via its existing `fields`/`fieldSource` prop), the native bounded `ListView`/`ListHeader`/`ListRows`, and `ListFooter` for paging (C1–C7). Filter/sort/search are applied by the SERVER (D1) — `Filter` emits frappe's own filter dict, which reaches `get_all` untouched. Default columns are the fields the panel itself resolves; the picker offers the rest |
| `frontend/src/tatva/listColumns.js` | + `alignFor` | Numeric right, text left — the same rule `ColumnSettings.addColumn` applies to a hand-added column, so a default and an added column agree |
| `frontend/src/tatva/DetailPanel.vue` | `// TATVA:` (NEW earlier) + a section-level `View more` in the group header (sibling of the collapse button, H1) with the row count as a `Badge`; mounts `SectionRowsModal` behind `v-if` | `has_more` used to be attached to every FIELD, so all 17 lab measurements grew a `More` button, each opening ONE COLUMN of the same rows. The server now serves `multi_row`/`row_count` once per section |
| `frontend/src/tatva/listColumns.js` | NEW (`widthFor` / `formatCell` / `isPill`) | The typed-column rule lived inside `SmartViewList` and was about to be copied into the rows modal. One rule, one home — a column of the same fieldtype must look identical wherever it is drawn |
| `frontend/src/tatva/SmartViewList.vue` | `// TATVA:` (NEW earlier) + its local `WIDTHS`/`widthFor`/`formatCell`/`isPill` deleted in favour of the shared `listColumns` | Removing the copy, not sharing a second one |
| `frontend/src/tatva/ResponsiveDialog.vue` | `// TATVA:` + a `mode` prop forwarded to `TatvaBottomSheet` | H6: a sheet whose content ARRIVES is `snap`, not `fit`. The prop existed on the sheet but the wrapper never forwarded it, so `mode` landed nowhere. Defaults to `'fit'`, so every existing consumer is byte-for-byte unchanged (G4) |
| `frontend/src/tatva/useEntitledGrains.js` | `// TATVA:` (NEW earlier) + `grainLabel(g)` EXPORTED — the label expression that was inline in `grainOptions` | How a grain reads (` · ` joined, containment order, `Universal` when every axis is blank) was a literal inside one computed, so the workflow canvas wrote its own and picked a slash the app uses nowhere. Exporting the rule and calling it from both is de-duplication, not a new brain; `GrainSelect` and `SmartViewEditor` are byte-for-byte unaffected |
| `frontend/src/tatva/workflows/workflowLabels.js` | NEW | The ONE orientation line for a workflow — what it watches, on which save, for whose business line — read by the canvas header and the runs page header. It only RENAMES `trigger_vertical/group/program` onto the shape `grainLabel` reads; it decides nothing about how a grain looks. Replaces a `split('::').pop()` that was guessing at a separator these flat values never carry |
| `frontend/src/tatva/workflows/WorkflowDetail.vue` | `// TATVA:` `subtitle` now calls `workflowSubtitle`; local `leafOf` deleted. The `Runs` button is a `router-link` with `target="_blank"` | One labeller instead of a private copy. New tab because vue-router hands a `_blank` link to the browser (`guardEvent`), and because navigating in place made the canvas's unsaved-work guard fire just to read a run |
| `frontend/src/tatva/workflows/WorkflowRuns.vue` | `// TATVA:` (NEW earlier) + the workflow's grain in `#right-header` | A journey stores no grain of its own and every row on the page is the same workflow, so a column would repeat one value down the whole list. `tatva_connect` `CRM Workflow.default_list_data` gained Vertical/Group/Program COLUMNS instead, where they discriminate — the three fields were already being fetched and simply never drawn |
| `frontend/src/tatva/SectionHistoryModal.vue` | unchanged; now reached by key-value sections only | A key-value row IS its field, so a question's answers and a field's history are the same list. A multi-row section is a table and answers through `lead_detail_rows` |

### Workflow runs — a native list PAGE, and one modal deleted (2026-08-09)

One workflow's run history was a `ResponsiveDialog` that hardcoded its own six columns and their widths, its own search box, its own status dropdown and its own paging — so a reader could not add a column, could not sort, and lost a dragged width the moment it closed. All of that is `CRM View Settings`, which is a per-user record attached to a doctype and a route, and a modal has no route. It is now a page at `/workflows/:workflowId/runs`, assembled exactly as `pages/Leads.vue` is: `ViewBreadcrumbs` + `ViewControls` + a list view with the same props, emits, select banner, bulk actions and footer. Row-level scoping is already enforced in SQL on `CRM Workflow Journey` (`permission_query_conditions` + `has_permission`, both `tatva_connect`), so a plain `crm.api.doc.get_data` is exactly as safe as the custom endpoint was. `history.runs_for_workflow` is no longer the list source and stays for the two things a `get_list` cannot derive (a failed run's reason, and what a parked one is waiting on).
| File | Change | Reason |
|------|--------|--------|
| `frontend/src/tatva/workflows/WorkflowRunsDialog.vue` | **DELETED** (with `tests/component/WorkflowRunsDialog.test.js`) | Its six columns, their five literal widths, the hand-rolled search, the status `<select>`, the fixed `h-[60vh]` and the Load-more arithmetic all became view settings owned by the native toolbar |
| `frontend/src/tatva/workflows/WorkflowRuns.vue` | NEW | The page. Clone of `pages/Leads.vue`'s shape; pinned to one workflow through `ViewControls`' own `filters` prop (native's `default_filters`), which also keeps the footer's total true. The workflow name is read from the SAME `get_workflow` resource under the SAME cache key the canvas uses, so arriving from the canvas paints it with no second call |
| `frontend/src/tatva/workflows/WorkflowRunsListView.vue` | NEW | Sibling of `WorkflowsListView.vue` — same props/emits/banner/bulk-actions/footer. Two cells differ, and only where a raw string would lie: `status` is a `Badge` themed by the shared `journeyStatus.js` (the colours the canvas and the lead's Workflow tab already use), and `subject_name` is a Dynamic Link resolved through `tatva/linkTitle` so the cell reads the lead's name while the row keeps the docname it filters by |
| `frontend/src/router.js` | `// TATVA:` +1 route `/workflows/:workflowId/runs` (`WorkflowRuns`) | Declared before `/workflows/:workflowId`, which matches one segment. The sidebar is already unlit on every detail page (`SidebarLink` marks on `route.name`), so nothing about navigation changes |
| `frontend/src/tatva/workflows/WorkflowDetail.vue` | `// TATVA:` the header's `Runs` button is a `router-link`; the dialog import, its `v-if` mount and `showRuns` are gone | One door, and one that opens in a new tab like every other link |
| `tatva_connect` `CRM Workflow Journey.default_list_data()` | new (backend) | The ONE declaration of the default columns and the fields fetched for them, in the place `crm.api.doc.get_data` already looks. A reader's own saved view replaces it; nothing on the client restates it |

### Surface visibility, unified — one rule, one boot key (2026-08-13)

Every gated surface used to answer its own question with its own boot-time HTTP call: `nearMe.js` called
`near_me_access`, `workflows.js` called `workflow_access`, and Deals would have needed a third. Three calls
that all resolve AFTER first paint, which is why the menu popped in. Now ONE server rule
(`tatva_connect.access.surfaces.my_surfaces`) answers the same two-part question for all three —
`frappe.has_permission(<the surface's doctype>)` AND the surface's operator toggle, never a role literal —
and the answer rides the boot payload `crm/www/crm.py` already serves. `crm.html` writes every boot key onto
`window.*`, so `composables/surfaces.js` reads it synchronously and the menu is correct on the first frame
with **zero** gate requests. All logic is in `tatva_connect`; the fork holds one boot key, the sidebar
conditions and the route guards. Stock crm (no `tatva_connect`) gets `{}` and is unaffected.

**Extended 2026-08-13 (Deal parity, phase 4):** Contacts and Organizations join the same gate — a contact
and an organization exist to be sold to, so both ride the SAME liveness answer Deals already computes
(the server reads it once, so two more surfaces cost zero extra queries) and both reuse the same
`surfaceGuard(key)` factory. In the same pass the Convert button stops lying about the second half of its
condition: `lead_stages()` now projects `is_conversion_point` on the query it was already running, the
stage pill publishes the picked stage's flag by emit, and both lead pages require it alongside
`surfaces.deals`. The server guard is still the only boundary.
| File | Change | Reason |
|------|--------|--------|
| `crm/www/crm.py` | `# TATVA:` +1 `get_surfaces()` helper and ONE `"surfaces"` key in `get_boot()`'s dict; resolves the `crm_surfaces` hook and calls it, falling back to `{}` | One boot key replaces three boot-time gate calls and the menu pop-in they caused. Same shape as `crm/api/whatsapp.py`'s `get_hooks` read, so a standalone crm keeps booting; wrapped in `try/except` because a broken gate must hide menus, never fail the page |
| `frontend/src/composables/nearMe.js`, `frontend/src/composables/workflows.js` | **DELETED** | Their one job — a boot-time `call()` into a ref — is what the boot key removed. `workflows.js` was never listed in this table; it is recorded here on the way out |
| `frontend/src/components/Layouts/AppSidebar.vue` | `// TATVA:` the two gate imports collapse to one (`surfaces`); Near Me and Workflows conditions read `surfaces.near_me` / `surfaces.workflows`, and the existing `Deals` link gains `condition: () => surfaces.deals` | Deals is a per-business-line surface: a line with no deals must not offer the menu item. The `links.filter` that honours `condition()` was already there |
| `frontend/src/components/Mobile/MobileSidebar.vue` | `// TATVA:` same import swap; Near Me reads `surfaces.near_me` and `Deals` gains the same condition | The PWA can never offer a surface the desktop hides. (Mobile lists no Workflows link — the canvas is a desktop surface — so there is nothing to gate there) |
| `frontend/src/router.js` | `// TATVA:` one shared `surfaceGuard(key)` factory; `/near-me` uses `surfaceGuard('near_me')` (replacing its inline `nearMeReady` guard) and the three `/workflows*` routes use `surfaceGuard('workflows')` | A direct URL is judged by the same settled answer the sidebar reads, so a hidden surface is refused rather than rendered and then denied. The workflow routes had no guard at all — the new `Workflow::Authoring::surface` switch would otherwise hide the menu and leave the address open |
| `frontend/src/pages/Lead.vue` | `// TATVA:` +1 import; `v-if="surfaces.deals"` on the Convert to Deal button | The affordance stops lying when no business line sells deals. **Not the security boundary** — `tatva_connect.deal.deals.guard_conversion_point` / `guard_deals_enabled` refuse on the server, on every path |
| `frontend/src/pages/MobileLead.vue` | `// TATVA:` +1 import; the Convert button's `v-if` gains `&& surfaces.deals` | Same rule on the PWA |
| `frontend/src/components/ListBulkActions.vue` | `// TATVA:` +1 import; the bulk `Convert to Deal` item is added only when `surfaces.deals`; `convertToDeal()`'s `.then()` gains a `.catch()` that toasts `e?.messages?.[0]` | Per-lead readiness cannot be judged for a selection, so the server stays the authority — and its refusal was an unhandled rejection with nothing shown. The toast repeats what the server said; no new copy |
| `frontend/src/composables/surfaces.js` | `// TATVA:` (NEW above) + two more getters, `contacts` and `organizations`, read off the same boot key | Same fail-closed read as the other three; the server decides, this only reports |
| `frontend/src/components/Layouts/AppSidebar.vue` | `// TATVA:` (above) + `condition: () => surfaces.contacts` / `surfaces.organizations` on the existing `Contacts` and `Organizations` links | A business line that sells no deals has no customers to file either, so the two links follow Deals rather than standing open |
| `frontend/src/components/Mobile/MobileSidebar.vue` | `// TATVA:` (above) + the same two conditions | PWA parity, so the phone can never offer a surface the desktop hides |
| `frontend/src/router.js` | `// TATVA:` (above) + `surfaceGuard('contacts')` on `/contacts/view/:viewType?` and `/contacts/:contactId`, `surfaceGuard('organizations')` on the two organization routes | The SAME factory, reused — the record route is guarded as well as the list, or a hidden surface is still reachable by deep link |
| `frontend/src/tatva/TatvaStagePill.vue` | `// TATVA:` (NEW elsewhere) + a `conversion-point` emit carrying the picked stage's `is_conversion_point`, watched with `immediate` | The flag now rides `lead_stages()`, the list the pill had already fetched, so the parent learns it with no extra request. Emit is how this component already publishes state |
| `frontend/src/pages/Lead.vue` | `// TATVA:` (above) + an `atConversionPoint` ref fed by the pill's emit; the Convert button's `v-if` becomes `surfaces.deals && atConversionPoint` | Phase 3 could only gate on the surface half; a lead parked at a stage it cannot convert from still offered the button and the server refused it. **Still not the security boundary** |
| `frontend/src/pages/MobileLead.vue` | `// TATVA:` (above) + the same ref and the same extra `v-if` term | Same rule on the PWA |

### Deal parity — the seven Deal surfaces (2026-08-13, phase 5)

A Deal is the customer a Lead became, so every surface here reads the patient **through `deal.lead`** and
copies nothing onto the deal. Which records carry the lead-shaped tabs is now ONE membership test on the
client (`tatva/railParents.js`, the mirror of `tatva_connect.activity.timeline.RAIL_PARENTS`) instead of a
`doctype === 'CRM Lead'` comparison repeated once per tab. All logic stays in `tatva_connect`.

| File | Change | Reason |
|------|--------|--------|
| `frontend/src/tatva/railParents.js` | **NEW** — `RAIL_PARENTS`, `isRailParent(doctype)`, `patientLead(doctype, doc)` | The client half of the server's own `RAIL_PARENTS`. `patientLead` is the `deal.lead` hop, in one place, so a lead-anchored panel never receives a deal id |
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` (rows above) — the Tasks, Workflow and Data branches gate on `isRailParent(doctype)` instead of `=== 'CRM Lead'`; `<TatvaTasks>` and `<WorkflowHistory>` are handed `patientLeadName`; the now-unreachable native `<TaskArea>` branch and its import are **removed** | Every mount of this component is a rail parent (Lead.vue, MobileLead.vue, Deal.vue, MobileDeal.vue), so the native branch was dead once Tasks widened. A journey's subject is always the LEAD (interpreter D7), so a deal's Workflow tab asks about its patient |
| `frontend/src/tatva/DetailPanel.vue` | `// TATVA:` (NEW earlier) + `doctype` travels to `lead_detail`, the resolved `lead` comes back and keys the history/rows modals, and `read_only` replaces the Edit button with a one-line notice | A deal's Data tab is its LEAD's sections. The hop is ONE server hop at the entry point; read-only because `update_lead_detail`'s allowlist is built for a lead |
| `frontend/src/components/Modals/DealModal.vue` | `// TATVA:` (first marks on this file) + `<GrainSelect resolve-wildcard>` under the layout, a `grainKey` watcher writing the three axis columns, and a `layoutTabs` computed that strips those columns for anyone but a System Manager and hides a section left empty | The same seam `LeadModal.vue` mounts. Empty sections are dropped because stock `Section.vue` renders on `!section.hidden` alone, so a stripped section would show as a bare header. The pick is a convenience only — `deal.deals.stamp_grain_from_lead` re-derives the grain from the lead on every save |
| `frontend/src/components/GlobalSearch.vue` | `// TATVA:` +1 branch — a `CRM Deal` hit routes to `{ name: 'Deal', params: { dealId } }` | A deal is not a child of a lead, so it opens its own record rather than a lead tab. `TAB['CRM Deal']` is `None` on the server for the same reason |
| `frontend/src/components/SearchResults.vue` | `// TATVA:` +1 import (`DealsIcon`) and +1 `TYPE` row giving the deal tier its own `Deals` heading | The server's declaration order is display order, so the tier already groups; this only names it |
