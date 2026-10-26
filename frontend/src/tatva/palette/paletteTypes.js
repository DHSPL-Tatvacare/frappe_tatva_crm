// TATVA: the palette's shared words, Helpdesk's `paletteTypes.ts`; a Command is Helpdesk's shape (its `command-palette/README.md`) plus `meta` and `badge`, a record row's second line and stage.

// CRM's additions to Helpdesk's Command: `stay` performs without closing, `levelTag` names a level, and a level's `commands` may be a function (re-read live).

// Untranslated: the palette translates a group once, where it renders. "" is an untitled group.
export const GROUP = {
  lead: 'Lead',
  list: 'List',
  recent: 'Recent',
  navigate: 'Navigate',
  create: '',
  account: 'Account',
}

// Screen rows lead the global list once typed; they rank, never gate.
export const CONTEXT_WEIGHT = 1.2
// Above search hits, below the drill-down parent: "follow" leads with the picker, then "Set stage: Follow-up".
export const FLAT_OPTION_WEIGHT = 1.15
// Nav links are noise once the user has typed something real.
export const NAV_WEIGHT = 0.7

// The server wraps a match in <mark>; split on it and strip every tag, so no indexed text renders as markup.
export function titleRuns(marked) {
  return (marked ?? '')
    .split(/(<mark>[\s\S]*?<\/mark>)/g)
    .map((part) => ({ text: stripTags(part), match: part.startsWith('<mark>') }))
    .filter((run) => run.text.length > 0)
}

export function stripTags(value) {
  return (value ?? '').replace(/<[^>]*>/g, '')
}

// A resource the palette reads on first use and keeps: no screen pays for a list it never opens.
export function loaded(resource) {
  // Justified: a row whose options did not load is simply not offered; the reason stays on `resource.error`.
  if (!resource.data && !resource.loading && !resource.error) resource.fetch().catch(() => {})
  return resource.data
}
