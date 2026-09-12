// TATVA: how a membership operator's value is written down, in ONE place.
//
// `is one of` / `is not one of` hold several values in a single stored string. The engine splits that
// string on a comma OR a newline (`automation/rules.py:_split_list`) — this file is that same sentence in
// JavaScript, and the only one the frontend is allowed to speak. A second copy is a defect: the two
// languages would drift and a condition would mean one thing to the author and another to the engine.
//
// WRITING joins with a NEWLINE. Reading stays wider than writing, so every value already stored — all of
// them comma-typed today — keeps its exact meaning and nothing has to be rewritten.
//
// A COMMA INSIDE A VALUE CANNOT BE EXPRESSED, and no separator choice here changes that: the ENGINE
// splits on comma, so such a value fragments however it was written. One live `CRM Task Type` contains
// commas. `unexpressable` names those values so the author is told, rather than silently saving a
// condition that can never match — author error is data, not an exception.

const JOIN = '\n'

// Read: comma OR newline, trimmed, blanks dropped — byte-for-byte the engine's rule.
export function splitItems(value) {
  if (Array.isArray(value)) return clean(value)
  return clean(
    String(value ?? '')
      .replace(/\n/g, ',')
      .split(','),
  )
}

// Write: the chosen values, joined. Each is stored WHOLE — never re-split, or a picked value would
// fragment on its way out as well as on its way back.
export function joinItems(list) {
  return clean(Array.isArray(list) ? list : splitItems(list)).join(JOIN)
}

// Which of the chosen values the engine cannot read back as one value.
export function unexpressable(list) {
  return clean(Array.isArray(list) ? list : splitItems(list)).filter((v) => v.includes(','))
}

function clean(list) {
  return list.map((v) => String(v ?? '').trim()).filter(Boolean)
}
