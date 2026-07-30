// The cache generation of every FIELD-LIST resource — filter, sort, group-by, columns, quick filters.
// A frappe-ui resource cache has NO TTL and is mirrored to IndexedDB, so a rep who opened a list page once
// keeps that page's field list forever; a field added on the server would never appear for them again.
// Every one of those five resources carries this constant in its cache key, so bumping it HERE, once,
// retires all five together. Bump it whenever the set of fields a lens can return changes shape.
export const LENS_CACHE_GENERATION = 'v2'
