// TATVA: tiny shared formatters for the Smart Views surface (desktop strip + mobile sheet share these).

// Compact a row count for a fixed-width tab/badge: 1–999 as-is, then k / m with one decimal
// (trailing .0 trimmed) — e.g. 13250 -> "13.2k", 1000000 -> "1m". Keeps the count bubble small
// enough to live inside the fixed 176px tab without pushing the label.
export function formatCount(n) {
  const v = Number(n)
  if (!isFinite(v)) return ''
  if (v < 1000) return String(v)
  if (v < 1_000_000) return trim(v / 1000) + 'k'
  return trim(v / 1_000_000) + 'm'
}

function trim(x) {
  const s = x.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}
