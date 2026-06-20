// TATVA: tiny shared formatters for the Smart Views surface (desktop strip + mobile sheet share these).

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
