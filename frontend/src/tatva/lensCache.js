// The cache generation of every FIELD-LIST resource — filter, sort, group-by, columns, quick filters.
// A frappe-ui resource cache has NO TTL and is mirrored to IndexedDB, so a rep who opened a list page once
// keeps that page's field list forever; a field added on the server would never appear for them again.
// Every one of those five resources carries this constant in its cache key, so retiring all five together
// is one edit here — and it is now TWO parts, because only one of them is ours to bump.
//
// SHAPE is ours: bump it whenever the set of fields a lens can return changes shape, as a deploy does.
// The DECLARATION VERSION is the server's, and no constant in this file could ever know it: a derived field
// is an operator-authored `CRM Derived Field` row, so the five menus change on a Save with no deploy at all.
// It is the max `modified` across the enabled rows, handed over as `window.derived_field_version` — the same
// boot door `window.sysdefaults` and `window.translated_messages` already arrive through (`crm.www.crm`).
// Author a field and every rep's next page load asks a key nobody has ever cached. That is the mechanism
// the whole "live on Save" promise rests on; without it the promise is false for anyone already loaded.
// v4: a Link at a composite master now carries `link_query`, so every cached lens predates the field.
const SHAPE = 'v4'

// The generation as of RIGHT NOW. The version is a timestamp and this string ends up in an IndexedDB key,
// so it is reduced to what is safe and stable there; a site whose boot does not carry one reads SHAPE
// alone, which is exactly the behaviour this file had before and never a key that churns per load.
export function lensCacheGeneration() {
  const declared = String(globalThis.derived_field_version ?? '').replace(
    /[^0-9a-zA-Z]/g,
    '',
  )
  return declared ? `${SHAPE}-${declared}` : SHAPE
}

// Snapshotted at module evaluation, which is what the five call sites need: a frappe-ui `cache` key is read
// ONCE at setup (`resources.js`) and a value that arrived later would never reach it. Evaluation is after
// boot on both paths — a deferred module script runs after the inline boot script in prod, and in dev
// `main.js` awaits `get_context_for_dev` before mounting while every consumer of this file is a lazy page.
export const LENS_CACHE_GENERATION = lensCacheGeneration()
