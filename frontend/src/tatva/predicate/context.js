// TATVA: the one injection key for the predicate family — the shape ListView uses for the same reason
// (a recursive tree cannot drill props through itself without every level knowing what the next needs).
export const PREDICATE_CONTEXT = Symbol('tatva:predicate')
