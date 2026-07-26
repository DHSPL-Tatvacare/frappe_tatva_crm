// TATVA: the one client-side reader of the framework's `_link_titles` map, shared by every list view.
// A Link column stores the target's primary key. For our grain-scoped masters (CRM Lead Stage,
// CRM Task Type, CRM Picklist Value) that key is a composite `vertical::group::program::name`, so the
// cell must render the target's title_field instead. get_data ships `_link_titles` keyed
// `{doctype}::{pk}` for every Link whose target sets show_title_field_in_link; this reads it.
//
// The row keeps the PK, which is what the list filters, sorts and groups by. Resolving the title on
// the server and writing it back into the row would destroy that key: filtering would send the label
// and match nothing, and group-by would merge two stages that share a name across programs.

// The raw map lookup. Cells reach it through `linkTitle` (which knows a column); the group-by header
// reaches it with the target doctype it read off the list's own field list. One reader, two callers.
export function linkTitleFor(doctype, value, list) {
  if (!doctype || !value) return null
  return list?.data?._link_titles?.[`${doctype}::${value}`] || null
}

export function linkTitle(value, column, list) {
  if (column?.type !== 'Link' || !column?.options || !value) return null
  return linkTitleFor(column.options, value, list)
}
