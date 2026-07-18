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
| `frontend/src/components/ListViews/ListRows.vue` | `// TATVA:` restored `h-full min-h-0 overflow-y-auto` on the ungrouped scroll container (line ~33) | Inherited frappe/crm bug: the ungrouped list didn't scroll on mobile/PWA (the grouped sibling already had the height chain) |
| `frontend/src/components/Activities/ActivityHeader.vue` | `// TATVA:` mounts the **native** `<Filter doctype="CRM Task" :fields>` left of New Task (Tasks tab) + `onTaskFilter` | Status/task-type filter for the lead Tasks board — the standard Filter.vue (guarded `fields` prop), wired client-side via the shared `tatva/taskFilter.js` + `filtersToPredicate` (no custom filter UI) |
| `frontend/src/components/Activities/ActivityHeader.vue` | Tasks button → native split-dropdown (`// TATVA:`) + `taskActions` | New Task (primary) + Log Activity (`window.__tcLogActivity`, now owned by `<TatvaTasks>`) via frappe-ui `Button`+`Dropdown` |
| `frontend/src/components/Activities/ActivityHeader.vue` | `// TATVA:` shared toolbar — a search `FormControl` + the native `Filter` (driven by the active tab's published `fields`) added to the header row for Comments/Notes/Calls/Tasks/Attachments; writes to `activityToolbar` | One search+filter mechanism across all activity tabs (the Tasks-only `Filter` was generalised, not removed) |
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` `displayActivities` applies the toolbar search+predicate to each filterable tab's already-loaded items (client-side, no extra API); a single per-tab `watch(title)` owns toolbar reset + publishes the static filter catalogs | Comments/Notes/Calls/Tasks/Attachments gain search+filter with no new state/fanout |
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` `scroll()` no-hash auto-scroll gated to WhatsApp only | The newest-first feeds (Activity/Emails/Comments) no longer jump down into history on load; deep-link (hash) scroll preserved |
| `frontend/src/components/Activities/AllModals.vue` | `// TATVA:` `showNote` opens `<TatvaNoteModal>` (mounted in this component) instead of the generic doctype modal; `onNoteSaved` keeps the same reload/onboarding/telemetry/redirect side-effects | Notes get a modal with native attachments; tasks/calls keep the generic modal |
| `frontend/src/components/Modals/DoctypeModal.vue` | `// TATVA:` +1 import, `<Dialog>` to `<ResponsiveDialog>` (same `#body` slot) | The generic create/edit modal (Add Call and every other doctype) was a centered Dialog on mobile. The tag swap makes it a bottom sheet on the PWA and leaves desktop byte-for-byte stock. One path: no per-doctype sheet variants |
| `frontend/src/components/Activities/CallArea.vue`, `frontend/src/pages/CallLogs.vue` | `// TATVA:` added `v-if` beside the existing `v-model` on `<CallLogDetailModal>` | The stock contract (`GlobalModals.vue:3`, `DoctypeModals.vue:3`) is `v-if` **and** `v-model`: `v-if` gives a fresh component per open, `v-model` drives visibility. Without it the modal is a page-lifetime singleton that retains the last call log, so opening a second one paints the first for a frame. 45 of the app's 55 mount sites already did this; these were outliers |
| `frontend/src/components/Modals/LeadModal.vue` | `// TATVA:` +3 imports (`ResponsiveDialog`, `GrainSelect`, `useEntitledGrains`), `<Dialog>` to `<ResponsiveDialog>`, `<GrainSelect>` mounted under the layout, and a `layoutTabs` computed that strips the forced `custom_vertical`/`custom_group`/`custom_current_program` fields for anyone who is not a System Manager — then drops any section left with no fields | Grain is the user's entitlement, never a free pick: a single-grain user's grain is applied silently (backend `CRM Lead.before_validate` is the fail-closed clamp), a manager picks. The empty-section drop is needed because stock `Section.vue` renders a section on `!section.hidden` alone, so a fully-stripped section would show as a bare header. Was previously undeclared here |
| `frontend/src/components/ListViews/LeadsListView.vue` | `// TATVA:` +1 import; `getLabel` resolves a Link cell through `tatva/linkTitle` (the framework's `_link_titles` map) | A Link cell holds the target's PK, which for our grain masters is a composite `::` key. The row keeps the PK (the list filters, sorts and groups by it) and the map carries the title |
| `frontend/src/components/ListViews/TasksListView.vue` | `// TATVA:` +1 import; same `getLabel` change | Same, for `custom_task_type`. Replaces the deleted `parse_list_data` server overrides, which overwrote the PK in the row and so broke click-to-filter and merged same-named stages across programs |
| `frontend/src/components/UserDropdown.vue` | `// TATVA:` dropped `condition: () => !isMobileView.value` from the `settings` case | Settings was unreachable on the PWA. Mobile now has a settings surface (`tatva/SettingsSheet`) bound to the same `showSettings` ref, so the item no longer needs hiding. `login_to_fc` keeps its gate |
| `frontend/src/components/Layouts/MobileLayout.vue` | `// TATVA:` +1 import + `<SettingsSheet />` | The mobile counterpart of `AppSidebar`'s `<Settings>`. Mounted in the LAYOUT, not in `MobileSidebar`, whose subtree lives inside a headlessui Dialog and unmounts with the drawer. One `showSettings` state, two renderers, chosen by layout |
| `frontend/src/pages/Notes.vue` | Rewritten from a card grid to the native list view (mirrors `Tasks.vue`): `ViewControls` (search/filter/sort/columns) + `<NotesListView>`, rows/columns parsed via `parseRows`; create/edit open `<TatvaNoteModal>` (attachments) | Notes main page is now a full native list with the standard toolbar; row-click opens the unified note modal |
| `frontend/src/components/ListViews/NotesListView.vue` | New file (mirrors `TasksListView.vue`) | Native `ListView` for FCRM Note: owner avatar, timeAgo dates, Text-Editor content, bulk actions; row-click emits `showNote` |
| `frontend/src/pages/Tasks.vue` | `// TATVA:` import + `showTask` intercept + `<TatvaTaskModal>` mount | Global Tasks list/kanban: an activity task (type carries config) opens our config-driven modal via `activity.api.task_detail`; plain tasks keep the native doctype modal |
| `frontend/src/pages/Lead.vue` | `// TATVA:` import + header status `<Dropdown>` replaced by `<TatvaStagePill>` (writes the rep's pick `custom_substage` via `triggerOnChange`; reads derived parent `custom_stage` as `mainStage`) | Lead lifecycle is grain-scoped: the rep picks the leaf `custom_substage`, the server derives the parent `custom_stage` (and native global `status` from it); native `status`/SLA/Convert plumbing left intact, just no longer rendered in the header |
| `frontend/src/pages/MobileLead.vue` | `// TATVA:` import + mobile status `<Dropdown>` replaced by the same `<TatvaStagePill>` | Mobile parity for the grain-scoped lead stage pill (field reps are mobile-first); same component, same `custom_substage` write path / `custom_stage` derived-parent read |
| `frontend/src/App.vue` | `// TATVA:` +3 imports + `onMounted` (when `session.isLoggedIn`) calling `initTatvaPush()`, `startTatvaPresence($socket)`, `startTatvaNotify($socket)` | One touchpoint for the rep's notification surface: registers FCM push, starts the presence heartbeat, and attaches the in-app toast handler to the existing CRM socket. No-op until `CRM Push Settings` is filled; all logic lives in `tatva_connect` + `src/tatva/` |
| `frontend/src/components/Settings/Settings.vue` | `// TATVA:` +1 import (`NotificationsSettings`) + a guarded **Notifications** item under "User Configuration" | Native per-user notification prefs panel. Guarded (`...(NotificationsSettings ? [...] : [])`) so stock CRM is unaffected when the panel isn't bundled |
| `frontend/package.json` | added the `firebase` dependency | Browser FCM SDK used by `src/tatva/push.js` (token mint + foreground message) and the messaging service worker |
| `frontend/src/composables/useActiveTabManager.js` | `// TATVA:` `scrollActiveTabIntoView()` — re-scrolls the active tab into view on (re)mount and on tab change (guarded; no-op when already visible) | Selecting a tab changes the route hash → router-view (keyed on `fullPath`) remounts the page → the horizontal tab strip's `scrollLeft` reset to 0, throwing mobile users back to the first tab. Fix lives in the shared tab brain so it covers every tab/page (lead + deal, mobile + desktop) |
| `.github/workflows/frontend-tests.yml`, `.github/workflows/server-tests.yml` | `# TATVA:` removed the coverage-artifact upload + the "Coverage Wrap Up" job; DELETED `.github/actions/publish-codecov` and `.github/actions/upload-coverage` | Strip the only external data service in CI — `codecov/codecov-action` uploaded coverage to codecov.io (a third party). Tests still run + gate; no coverage data leaves CI (the `develop`-only gate meant it never ran on `tatva` anyway, but the integration is now gone entirely) |
| `crm/api/activities.py` (`get_attachments`) | `# TATVA:` +1 field (`custom_review_status`) in the File projection that feeds the Attachments tab | The document-review verdict (mirrored onto the File by `tatva_connect`) rides the SAME `get_activities` resource already loaded, so the Attachments-tab badge needs no extra call/fanout. Overriding `get_activities` would fork the whole lead+deal assembler (parallel brain); one field on the existing projection is the minimal path. Blank ⇒ never reviewed ⇒ no badge |
| `frontend/src/components/Activities/AttachmentArea.vue` | `// TATVA:` native frappe-ui `Badge` next to `file_name`, shown only when `attachment.custom_review_status` is truthy; `reviewTheme()` maps Approved→green / Rejected→red / Pending→gray (token-based Badge themes) | Surfaces the document-review verdict on the attachment card; blank documents show nothing. Reads at ~390px (flex-shrink-0 badge, name truncates). No new resource — the field arrives in the existing `all_activities` payload |

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
| `frontend/src/components/Activities/Activities.vue` | `// TATVA:` Notes branch swapped from the tall 3-col `NoteArea` grid to the unified timeline-card shape (rail + "added a note" header + content block) via `<NoteCard>` (import swap `NoteArea` → `tatva/NoteCard`) | Notes share one design language with Calls/Comments/Tasks; upstream `NoteArea.vue` untouched |

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
| `frontend/src/composables/nearMe.js` | NEW (`// TATVA:` `nearMeVisible` ref + `resolveNearMeAccess()`, auto-resolved once on load) | Near Me access gate, mirrors `whatsapp.js`; fail-closed (no access ⇒ link hidden) |
| `frontend/src/components/Layouts/AppSidebar.vue` | `// TATVA:` +2 imports (`LucideMapPin`, `nearMeVisible`) + ONE gated link `{ label:'Near Me', to:'NearMe', condition: () => nearMeVisible.value }` in `links` | Desktop sidebar entry; `condition()` already honoured by the existing `links.filter`, so stock CRM is unaffected when access is off |
| `frontend/src/components/Mobile/MobileSidebar.vue` | `// TATVA:` +2 imports + the same gated link + `links.filter(link.condition)` in `allViews` (mobile previously mapped `links` unfiltered) | Mobile parity for the gated Near Me link (left panel, not a bottom-nav tab) |
| `frontend/src/router.js` | `// TATVA:` top-level route `{ path:'/near-me', name:'NearMe', component: () => import('@/pages/NearMe.vue') }` before the catch-all | Routes the page; `beforeEach` special-cases only the list pages, so `/near-me` falls through to `next()` |
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
  `tatva_connect.activity.api.lead_task_board`). Each task renders in the **unified activity-card shape**
  (timeline rail + "{rep} logged a task · {when}" header + a bordered content block of status/details),
  matching Calls/Comments. Card status control routes Done through our complete flow with the exact
  `task.name` (no DOM/title guessing); owns the ad-hoc create flow (grain-scoped picker → create modal)
  and `window.__tcLogActivity`.
- `frontend/src/tatva/NoteCard.vue` — a single FCRM Note in the unified activity-card shape (header
  "{owner} added a note · {when}" + delete + a bordered title/content block). Mounted by the Notes branch
  in `Activities.vue` behind a timeline rail; replaces the tall 3-col grid of native `NoteArea` cards
  (upstream `NoteArea.vue` left untouched — no divergence).
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
- `frontend/src/composables/nearMe.js` — Near Me access gate (`nearMeVisible` + `resolveNearMeAccess`),
  auto-resolved once on load from `near_me.api.near_me_access`; fail-closed.
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
