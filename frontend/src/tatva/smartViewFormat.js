// TATVA: tiny shared count/icon formatters. Used by the Smart Views surface and the dashboard, so a count
// reads the same wherever it is shown.

// Compact a row count for a tab/badge the LeadSquared way: 1–999 as-is, then K / M with up to two
// decimals (trailing zeros trimmed) — e.g. 726 -> "726", 13260 -> "13.26K", 33640 -> "33.64K",
// 1000000 -> "1M". Keeps the count pill small so it sits inside a content-width tab.
export function formatCount(n) {
  const v = Number(n)
  if (!isFinite(v)) return ''
  if (v < 1000) return String(v)
  if (v < 1_000_000) return trim(v / 1000) + 'K'
  return trim(v / 1_000_000) + 'M'
}

function trim(x) {
  return x.toFixed(2).replace(/\.?0+$/, '')
}

// The ONE icon rule for a view tab (desktop strip AND mobile sheet): the author's stored icon wins,
// else the LSQ-style default — a checkbox for activity views, a person for lead views. Two surfaces
// once answered this differently (Tabs derived, Sheet read the row and showed nothing when blank).
export function tabIcon(view) {
  return view?.icon || (view?.base_object === 'Activity' ? 'check-square' : 'user')
}
